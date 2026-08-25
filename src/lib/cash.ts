import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatDateInput } from "@/lib/datetime";
import type { RentalPayment } from "@/lib/contract";
import type { FieldChange } from "@/lib/movement-audit";
import { monthRangeUtc, resolveCashPeriod, type CashPeriod } from "@/lib/cash-period";
import { getSafeBalance } from "@/lib/safe";
import { emptyCurrencyTotals, sumByCurrency, type Currency, type CurrencyTotals } from "@/lib/currency";

// El tipo/las constantes/las funciones puras del filtro de fecha (Hoy/Semana/
// Mes/fecha puntual) viven en `cash-period.ts`, sin "server-only" — así el
// client component que dibuja el selector (`cash-period-picker.tsx`) puede
// importarlas sin arrastrar Prisma. Re-exportadas acá para no tener que
// cambiar los imports del resto del código de servidor (page.tsx, etc.).
export {
  monthRangeUtc,
  mondayOf,
  resolveCashPeriod,
  parseCashPeriod,
  cashPeriodSearch,
  DEFAULT_CASH_PERIOD,
  CASH_PERIOD_OPTIONS,
  type CashPeriod,
} from "@/lib/cash-period";

function monthOf(date: Date): string {
  return formatDateInput(date).slice(0, 7);
}

export function currentMonth(): string {
  return monthOf(new Date());
}

export type CashMovementRow = {
  id: string;
  type: "income" | "expense";
  description: string;
  amount: number;
  currency: Currency;
  paymentMethodId: string | null;
  paymentMethodName: string;
  paymentMethodNote: string | null;
  // Destino de un Egreso: cuenta ajena a la que se le pagó. Opcional — no
  // todo egreso tiene una cuenta ajena puntual. No se usa en Ingresos.
  recipientPaymentMethodId: string | null;
  recipientPaymentMethodName: string | null;
  recipientPaymentMethodNote: string | null;
  // Importado automático desde VikRentCar sin poder resolver el medio de pago
  // real — falta que alguien lo confirme (ver `confirmCashMovementPaymentMethod`).
  needsConfirmation: boolean;
  rentalId: string | null;
  rentalClientName: string | null;
  // Nº de orden de VikRentCar de la reserva vinculada (si tiene) — para poder
  // buscar un movimiento por número de reserva (ver `getCashSearchIndex`).
  rentalBookingId: string | null;
  createdByName: string;
  createdAt: Date;
};

export type CashPeriodDetail = {
  periodLabel: string;
  incomes: CashMovementRow[];
  expenses: CashMovementRow[];
  // Totales separados por moneda — nunca sumados entre sí (ver `src/lib/currency.ts`).
  totalIncome: CurrencyTotals;
  totalExpense: CurrencyTotals;
  net: CurrencyTotals;
};

async function findMovements(
  where: Prisma.CashMovementWhereInput,
  opts?: { take?: number },
): Promise<CashMovementRow[]> {
  const rows = await prisma.cashMovement.findMany({
    // Nunca trae deudas de proveedor (`type: "debt"`) — esas viven en
    // `src/lib/providers.ts`, no son un ingreso/egreso de caja real todavía.
    where: { type: { in: ["income", "expense"] }, ...where, deletedAt: null },
    include: {
      createdBy: { select: { name: true } },
      rental: { select: { clientName: true, wpBookingId: true } },
    },
    orderBy: { createdAt: "desc" },
    ...(opts?.take ? { take: opts.take } : {}),
  });
  return rows.map(
    (r): CashMovementRow => ({
      id: r.id,
      // El `where` de arriba ya excluye "debt" — este cast solo estrecha el
      // tipo para TS (Prisma no puede reflejarlo en el retorno).
      type: r.type as "income" | "expense",
      description: r.description,
      amount: Number(r.amount),
      currency: r.currency,
      paymentMethodId: r.paymentMethodId,
      paymentMethodName: r.paymentMethodName,
      paymentMethodNote: r.paymentMethodNote,
      recipientPaymentMethodId: r.recipientPaymentMethodId,
      recipientPaymentMethodName: r.recipientPaymentMethodName,
      recipientPaymentMethodNote: r.recipientPaymentMethodNote,
      needsConfirmation: r.needsConfirmation,
      rentalId: r.rentalId,
      rentalClientName: r.rental?.clientName ?? null,
      rentalBookingId: r.rental?.wpBookingId != null ? String(r.rental.wpBookingId) : null,
      createdByName: r.createdBy?.name ?? "—",
      createdAt: r.createdAt,
    }),
  );
}

/**
 * Ingresos importados automáticamente desde VikRentCar cuyo medio de pago no
 * se pudo resolver — independiente del período visible en Caja (no importa
 * cuándo llegó la seña: hasta que alguien lo confirme, sigue pendiente).
 */
export async function getUnconfirmedCashMovements(): Promise<CashMovementRow[]> {
  return findMovements({ needsConfirmation: true });
}

export async function getCashPeriodDetail(period: CashPeriod): Promise<CashPeriodDetail> {
  const { start, end, label } = resolveCashPeriod(period);
  const rows = await findMovements({ createdAt: { gte: start, lt: end } });

  const incomes = rows.filter((r) => r.type === "income");
  const expenses = rows.filter((r) => r.type === "expense");
  const totalIncome = sumByCurrency(incomes);
  const totalExpense = sumByCurrency(expenses);

  return {
    periodLabel: label,
    incomes,
    expenses,
    totalIncome,
    totalExpense,
    net: { ars: totalIncome.ars - totalExpense.ars, usd: totalIncome.usd - totalExpense.usd },
  };
}

export async function getOwnCashMovements(userId: string, month: string): Promise<CashMovementRow[]> {
  const { start, end } = monthRangeUtc(month);
  return findMovements({ createdById: userId, createdAt: { gte: start, lt: end } });
}

const SEARCH_INDEX_LIMIT = 500;

/**
 * Movimientos recientes (histórico, sin acotar al período visible de Caja)
 * para el buscador por cliente/N° de reserva/detalle — filtrado client-side
 * en `CashMovementSearch` (mismo patrón que `RentalPicker`/`PaymentMethodPicker`:
 * traer una lista acotada una vez, filtrar en el navegador mientras se
 * escribe). `includeExpenses` decide si entran los egresos — un empleado no
 * admin busca solo entre ingresos (misma restricción que el resto de Caja).
 */
export async function getCashSearchIndex(includeExpenses: boolean): Promise<CashMovementRow[]> {
  return findMovements(includeExpenses ? {} : { type: "income" }, { take: SEARCH_INDEX_LIMIT });
}

export type RentalPickerOption = {
  id: string;
  clientName: string;
  bookingId: string | null;
  plate: string | null;
  label: string;
};

const RETURNED_VISIBILITY_DAYS = 5;

/**
 * Reservas candidatas para vincular a un movimiento de Caja: las que todavía
 * no se devolvieron (reserved/active) más las recién devueltas (finished),
 * ocultando las que ya pasaron `RETURNED_VISIBILITY_DAYS` días desde la
 * devolución. Orden: `updatedAt` desc — se actualiza al entregar y al
 * devolver (ver saveHandover/saveReturn), así que aproxima "últimos
 * entregados/devueltos primero" sin necesitar el timestamp real de la
 * inspección.
 */
export async function getRentalPickerOptions(): Promise<RentalPickerOption[]> {
  const returnedCutoff = new Date(Date.now() - RETURNED_VISIBILITY_DAYS * 24 * 60 * 60 * 1000);

  const rentals = await prisma.rental.findMany({
    where: {
      OR: [
        { status: { in: ["reserved", "active"] } },
        { status: "finished", updatedAt: { gte: returnedCutoff } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 150,
    select: {
      id: true,
      clientName: true,
      startAt: true,
      wpBookingId: true,
      vehicle: { select: { plate: true } },
    },
  });

  return rentals.map((r) => {
    const bookingId = r.wpBookingId != null ? String(r.wpBookingId) : null;
    return {
      id: r.id,
      clientName: r.clientName,
      bookingId,
      plate: r.vehicle?.plate ?? null,
      label: `${r.clientName} — ${r.vehicle?.plate ?? "sin unidad"} (${formatDateInput(r.startAt)})${
        bookingId ? ` · #${bookingId}` : ""
      }`,
    };
  });
}

/**
 * Traduce las líneas de pago anotadas en la entrega/devolución (medio de pago
 * real, con % de ajuste y nota) a filas de `CashMovement` — un ingreso por
 * línea, vinculado a la reserva. Se usa dentro de la misma transacción de
 * `saveHandover`/`saveReturn` (ver esos archivos) para que la Caja quede al
 * día sin que el empleado tenga que anotarlo dos veces.
 */
export function paymentsToCashMovements(
  payments: RentalPayment[],
  opts: { rentalId: string; createdById: string; description: string },
): Prisma.CashMovementCreateManyInput[] {
  return payments.map((p) => ({
    type: "income" as const,
    description: opts.description,
    amount: p.adjustedAmount,
    paymentMethodId: p.methodId ?? null,
    paymentMethodName: p.methodName,
    paymentMethodNote: p.note ?? null,
    needsConfirmation: p.unconfirmed ?? false,
    rentalId: opts.rentalId,
    createdById: opts.createdById,
  }));
}

export type CashMovementFieldChange = FieldChange;

export type CashMovementEditRow = {
  id: string;
  action: "updated" | "deleted";
  changes: CashMovementFieldChange[] | null;
  editedByName: string;
  movementDescription: string;
  movementAmount: number;
  movementCurrency: Currency;
  movementType: "income" | "expense";
  createdAt: Date;
};

/**
 * Historial de ediciones/borrados de movimientos de Caja (Ingreso/Egreso), del
 * período visible (por fecha de la edición). Excluye ediciones de deudas de
 * proveedor (`type: "debt"`) — esas viven en la pestaña Proveedores, no acá.
 */
export async function getCashPeriodEdits(period: CashPeriod): Promise<CashMovementEditRow[]> {
  const { start, end } = resolveCashPeriod(period);
  const rows = await prisma.cashMovementEdit.findMany({
    where: { createdAt: { gte: start, lt: end }, cashMovement: { type: { in: ["income", "expense"] } } },
    include: {
      editedBy: { select: { name: true } },
      cashMovement: { select: { description: true, amount: true, currency: true, type: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    changes: (r.changes as CashMovementFieldChange[] | null) ?? null,
    editedByName: r.editedBy?.name ?? "—",
    movementDescription: r.cashMovement.description,
    movementAmount: Number(r.cashMovement.amount),
    movementCurrency: r.cashMovement.currency,
    movementType: r.cashMovement.type as "income" | "expense",
    createdAt: r.createdAt,
  }));
}

/**
 * Saldo de "Billetera": efectivo físico en mano que todavía NO se depositó en
 * la caja fuerte. Histórico completo (no por período) — mismo criterio que
 * `getSafeBalance`, representa cuánto hay HOY, no un movimiento puntual.
 * Separado por moneda (un ingreso en efectivo puede ser ARS o USD).
 *
 * Billetera = (ingresos − egresos en Caja con un medio marcado `isCash`) −
 * saldo actual de la Caja fuerte. Al depositar en la caja fuerte, ese saldo
 * sube y la Billetera baja en la misma medida (y al revés al retirar) —
 * la resta ya lo refleja sin tener que filtrar los SafeMovement acá.
 * Info sensible — solo para admin (mismo criterio que la Caja fuerte).
 */
export async function getWalletBalance(): Promise<CurrencyTotals> {
  const [income, expense, safeBalance] = await Promise.all([
    prisma.cashMovement.groupBy({
      by: ["currency"],
      where: { type: "income", deletedAt: null, paymentMethod: { isCash: true } },
      _sum: { amount: true },
    }),
    prisma.cashMovement.groupBy({
      by: ["currency"],
      where: { type: "expense", deletedAt: null, paymentMethod: { isCash: true } },
      _sum: { amount: true },
    }),
    getSafeBalance(),
  ]);
  const totals = emptyCurrencyTotals();
  for (const row of income) totals[row.currency] += Number(row._sum.amount ?? 0);
  for (const row of expense) totals[row.currency] -= Number(row._sum.amount ?? 0);
  return { ars: totals.ars - safeBalance.ars, usd: totals.usd - safeBalance.usd };
}
