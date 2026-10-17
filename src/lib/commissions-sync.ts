import "server-only";
import type { Prisma } from "@prisma/client";
import { computeCommission, resolveExpenseCommissionConfig, type ResolvedCommissionConfig } from "@/lib/commissions";
import { formatMoney } from "@/lib/contract";
import type { Currency } from "@/lib/currency";

type Tx = Prisma.TransactionClient;

/** Quién dispara el cambio (para la auditoría). `id: null` = automático (ej. sync de VikRentCar). */
export type CommissionActor = { id: string | null; name: string | null };

const DESCRIPTION_MAX = 500;

type CommissionSource = { description: string; amount: number; currency: Currency };

/**
 * Deja el egreso derivado de una comisión en el estado que corresponde hoy:
 * lo crea si el origen es elegible y todavía no existe, lo recalcula si
 * cambió (monto, moneda, cuenta o categoría) y lo elimina si ya no
 * corresponde. Idempotente: si ya está bien, no toca nada. Compartido por
 * `syncCommission` (comisión por ingreso) y `syncExpenseCommission` (comisión
 * por egreso) — cada una decide su propia elegibilidad y de dónde sale
 * `config`, esto solo escribe el resultado. Corre dentro de la transacción
 * del llamador para quedar atómico con el movimiento que la origina.
 */
async function applyCommission(
  tx: Tx,
  sourceId: string,
  eligible: boolean,
  source: CommissionSource,
  config: ResolvedCommissionConfig | null,
  method: { id: string; name: string } | null,
  actor: CommissionActor,
  notApplicableReason: string,
): Promise<void> {
  const existing = await tx.cashMovement.findFirst({ where: { commissionSourceId: sourceId, deletedAt: null } });

  const amount =
    eligible && config && method
      ? computeCommission({ amount: source.amount, currency: source.currency }, { percent: config.percent, fixed: config.fixed })
      : null;

  if (amount == null || !method || !config) {
    if (existing) await softDelete(tx, existing.id, actor, notApplicableReason);
    return;
  }

  const category = config.category;
  if (!existing) {
    await tx.cashMovement.create({
      data: {
        type: "expense",
        description: `Comisión ${method.name} — ${source.description}`.slice(0, DESCRIPTION_MAX),
        amount,
        currency: source.currency,
        paymentMethodId: method.id,
        paymentMethodName: method.name,
        categoryId: category?.id ?? null,
        categoryName: category?.name ?? null,
        commissionSourceId: sourceId,
        createdById: actor.id,
        createdByName: actor.name,
      },
    });
    return;
  }

  const changes: { field: string; from: string; to: string }[] = [];
  if (Number(existing.amount) !== amount) {
    changes.push({
      field: "Monto",
      from: formatMoney(Number(existing.amount), existing.currency),
      to: formatMoney(amount, source.currency),
    });
  }
  if (existing.currency !== source.currency) changes.push({ field: "Moneda", from: existing.currency, to: source.currency });
  if (existing.paymentMethodId !== method.id) {
    changes.push({ field: "Origen", from: existing.paymentMethodName, to: method.name });
  }
  if ((existing.categoryId ?? null) !== (category?.id ?? null)) {
    changes.push({ field: "Categoría", from: existing.categoryName ?? "—", to: category?.name ?? "—" });
  }
  if (changes.length === 0) return;

  await tx.cashMovement.update({
    where: { id: existing.id },
    data: {
      amount,
      currency: source.currency,
      paymentMethodId: method.id,
      paymentMethodName: method.name,
      categoryId: category?.id ?? null,
      categoryName: category?.name ?? null,
    },
  });
  await tx.cashMovementEdit.create({
    data: {
      cashMovementId: existing.id,
      action: "updated",
      changes,
      editedById: actor.id,
      editedByName: actor.name,
    },
  });
}

/**
 * Comisión por ingreso (ver `PaymentMethod.commissionPercent`). Solo
 * ingresos reales: no aplica a garantías, a egresos, ni a ingresos sin medio
 * de pago confirmado (los importados de VikRentCar sin resolver — se llama de
 * nuevo cuando alguien confirma el medio). El egreso sale de la misma cuenta
 * que recibió el ingreso, sin reserva vinculada, y apunta al ingreso vía
 * `commissionSourceId`.
 */
export async function syncCommission(tx: Tx, incomeId: string, actor: CommissionActor): Promise<void> {
  const income = await tx.cashMovement.findUnique({
    where: { id: incomeId },
    include: { paymentMethod: { include: { commissionCategory: { select: { id: true, name: true } } } } },
  });
  if (!income) return;

  const method = income.paymentMethod;
  const eligible =
    income.type === "income" &&
    !income.deletedAt &&
    !income.isGuarantee &&
    !income.needsConfirmation &&
    method != null;
  const config: ResolvedCommissionConfig | null = method
    ? {
        percent: method.commissionPercent != null ? Number(method.commissionPercent) : null,
        fixed: method.commissionFixed != null ? Number(method.commissionFixed) : null,
        category: method.commissionCategory,
      }
    : null;

  await applyCommission(
    tx,
    incomeId,
    eligible,
    { description: income.description, amount: Number(income.amount), currency: income.currency },
    config,
    method,
    actor,
    "Ya no corresponde comisión para el ingreso que la originó",
  );
}

/**
 * Comisión por egreso (ver `PaymentMethod.expenseCommissionMode`). Mismo
 * mecanismo que la comisión por ingreso, pero sobre un Egreso: Movimientos →
 * +Egreso, "+ Pago" a un Proveedor y un egreso cargado a un Asociado pasan
 * todos por `createCashMovement`/`updateCashMovement`, así que no hace falta
 * tocar nada puntual de cada uno. No aplica a garantías (devolver un depósito
 * no es un gasto del negocio) ni a un egreso que ya es, a su vez, la comisión
 * de otro movimiento (`commissionSourceId` no nulo) — una comisión nunca
 * genera su propia comisión, evita encadenarse sola.
 */
export async function syncExpenseCommission(tx: Tx, expenseId: string, actor: CommissionActor): Promise<void> {
  const expense = await tx.cashMovement.findUnique({
    where: { id: expenseId },
    include: {
      paymentMethod: {
        include: {
          commissionCategory: { select: { id: true, name: true } },
          expenseCommissionCategory: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!expense) return;

  const method = expense.paymentMethod;
  const eligible =
    expense.type === "expense" &&
    !expense.deletedAt &&
    !expense.isGuarantee &&
    expense.commissionSourceId == null &&
    method != null;
  const config: ResolvedCommissionConfig | null = method
    ? resolveExpenseCommissionConfig({
        expenseCommissionMode: method.expenseCommissionMode,
        commissionPercent: method.commissionPercent != null ? Number(method.commissionPercent) : null,
        commissionFixed: method.commissionFixed != null ? Number(method.commissionFixed) : null,
        commissionCategory: method.commissionCategory,
        expenseCommissionPercent: method.expenseCommissionPercent != null ? Number(method.expenseCommissionPercent) : null,
        expenseCommissionFixed: method.expenseCommissionFixed != null ? Number(method.expenseCommissionFixed) : null,
        expenseCommissionCategory: method.expenseCommissionCategory,
      })
    : null;

  await applyCommission(
    tx,
    expenseId,
    eligible,
    { description: expense.description, amount: Number(expense.amount), currency: expense.currency },
    config,
    method,
    actor,
    "Ya no corresponde comisión para el egreso que la originó",
  );
}

/**
 * Elimina (soft delete) el egreso de comisión derivado de un movimiento (de
 * ingreso o de egreso) que se está borrando — la comisión no tiene sentido
 * sin el movimiento que la originó.
 */
export async function deleteCommissionOf(tx: Tx, movementId: string, actor: CommissionActor): Promise<void> {
  const existing = await tx.cashMovement.findFirst({ where: { commissionSourceId: movementId, deletedAt: null } });
  if (existing) await softDelete(tx, existing.id, actor, "Se eliminó el movimiento que originó esta comisión");
}

async function softDelete(tx: Tx, id: string, actor: CommissionActor, reason: string): Promise<void> {
  await tx.cashMovement.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById: actor.id, deletedByName: actor.name },
  });
  await tx.cashMovementEdit.create({
    data: {
      cashMovementId: id,
      action: "deleted",
      changes: [{ field: "Motivo", from: "—", to: reason }],
      editedById: actor.id,
      editedByName: actor.name,
    },
  });
}
