import "server-only";
import type { Prisma } from "@prisma/client";
import { computeCommission } from "@/lib/commissions";
import { formatMoney } from "@/lib/contract";

type Tx = Prisma.TransactionClient;

/** Quién dispara el cambio (para la auditoría). `id: null` = automático (ej. sync de VikRentCar). */
export type CommissionActor = { id: string | null; name: string | null };

const DESCRIPTION_MAX = 500;

/**
 * Deja el egreso de comisión de un ingreso en el estado que corresponde hoy:
 * lo crea si el medio de pago tiene comisión y todavía no existe, lo
 * recalcula si cambió (monto, moneda, cuenta o categoría) y lo elimina si ya
 * no corresponde (se sacó la comisión del medio, o el ingreso pasó a otro
 * medio). Idempotente: si ya está bien, no toca nada.
 *
 * Solo ingresos reales: no aplica a garantías, a egresos, ni a ingresos sin
 * medio de pago confirmado (los importados de VikRentCar sin resolver — se
 * llama de nuevo cuando alguien confirma el medio). El egreso sale de la misma
 * cuenta que recibió el ingreso, sin reserva vinculada (los egresos son gastos
 * del negocio, no de una reserva) y apunta al ingreso vía `commissionSourceId`.
 * Corre dentro de la transacción del llamador para quedar atómico con el ingreso.
 */
export async function syncCommission(tx: Tx, incomeId: string, actor: CommissionActor): Promise<void> {
  const income = await tx.cashMovement.findUnique({
    where: { id: incomeId },
    include: { paymentMethod: { include: { commissionCategory: { select: { id: true, name: true } } } } },
  });
  if (!income) return;

  const existing = await tx.cashMovement.findFirst({ where: { commissionSourceId: incomeId, deletedAt: null } });

  const method = income.paymentMethod;
  const eligible =
    income.type === "income" &&
    !income.deletedAt &&
    !income.isGuarantee &&
    !income.needsConfirmation &&
    method != null;
  const amount =
    eligible && method
      ? computeCommission(
          { amount: Number(income.amount), currency: income.currency },
          {
            percent: method.commissionPercent != null ? Number(method.commissionPercent) : null,
            fixed: method.commissionFixed != null ? Number(method.commissionFixed) : null,
          },
        )
      : null;

  if (amount == null || !method) {
    if (existing) await softDelete(tx, existing.id, actor, "Ya no corresponde comisión para el ingreso que la originó");
    return;
  }

  const category = method.commissionCategory;
  if (!existing) {
    await tx.cashMovement.create({
      data: {
        type: "expense",
        description: `Comisión ${method.name} — ${income.description}`.slice(0, DESCRIPTION_MAX),
        amount,
        currency: income.currency,
        paymentMethodId: method.id,
        paymentMethodName: method.name,
        categoryId: category?.id ?? null,
        categoryName: category?.name ?? null,
        commissionSourceId: income.id,
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
      to: formatMoney(amount, income.currency),
    });
  }
  if (existing.currency !== income.currency) changes.push({ field: "Moneda", from: existing.currency, to: income.currency });
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
      currency: income.currency,
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
 * Elimina (soft delete) el egreso de comisión de un ingreso que se está
 * borrando — la comisión no tiene sentido sin el ingreso que la originó.
 */
export async function deleteCommissionOf(tx: Tx, incomeId: string, actor: CommissionActor): Promise<void> {
  const existing = await tx.cashMovement.findFirst({ where: { commissionSourceId: incomeId, deletedAt: null } });
  if (existing) await softDelete(tx, existing.id, actor, "Se eliminó el ingreso que originó esta comisión");
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
