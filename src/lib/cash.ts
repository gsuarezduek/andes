import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatDateInput, mendozaWallTimeToUtc } from "@/lib/datetime";
import type { RentalPayment } from "@/lib/contract";

function monthOf(date: Date): string {
  return formatDateInput(date).slice(0, 7);
}

export function currentMonth(): string {
  return monthOf(new Date());
}

/** Mes anterior a `ym` ("YYYY-MM"), maneja el cambio de año. */
export function prevMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** Mes siguiente a `ym` ("YYYY-MM"), maneja el cambio de año. */
export function nextMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

/** Rango [start, end) en UTC de un mes ("YYYY-MM") en hora Mendoza. */
export function monthRangeUtc(ym: string): { start: Date; end: Date } {
  return {
    start: mendozaWallTimeToUtc(`${ym}-01T00:00`),
    end: mendozaWallTimeToUtc(`${nextMonth(ym)}-01T00:00`),
  };
}

export type CashMovementRow = {
  id: string;
  description: string;
  amount: number;
  paymentMethodId: string | null;
  paymentMethodName: string;
  paymentMethodNote: string | null;
  rentalClientName: string | null;
  createdByName: string;
  createdAt: Date;
};

export type CashMonthDetail = {
  month: string;
  prevMonth: string;
  nextMonth: string;
  incomes: CashMovementRow[];
  expenses: CashMovementRow[];
  totalIncome: number;
  totalExpense: number;
  net: number;
};

async function findMovements(where: Prisma.CashMovementWhereInput) {
  const rows = await prisma.cashMovement.findMany({
    where: { ...where, deletedAt: null },
    include: { createdBy: { select: { name: true } }, rental: { select: { clientName: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(
    (r): CashMovementRow & { type: "income" | "expense" } => ({
      id: r.id,
      type: r.type,
      description: r.description,
      amount: Number(r.amount),
      paymentMethodId: r.paymentMethodId,
      paymentMethodName: r.paymentMethodName,
      paymentMethodNote: r.paymentMethodNote,
      rentalClientName: r.rental?.clientName ?? null,
      createdByName: r.createdBy?.name ?? "—",
      createdAt: r.createdAt,
    }),
  );
}

export async function getCashMonthDetail(month: string): Promise<CashMonthDetail> {
  const { start, end } = monthRangeUtc(month);
  const rows = await findMovements({ createdAt: { gte: start, lt: end } });

  const incomes = rows.filter((r) => r.type === "income");
  const expenses = rows.filter((r) => r.type === "expense");
  const totalIncome = incomes.reduce((sum, r) => sum + r.amount, 0);
  const totalExpense = expenses.reduce((sum, r) => sum + r.amount, 0);

  return {
    month,
    prevMonth: prevMonth(month),
    nextMonth: nextMonth(month),
    incomes,
    expenses,
    totalIncome,
    totalExpense,
    net: totalIncome - totalExpense,
  };
}

export async function getOwnCashMovements(
  userId: string,
  month: string,
): Promise<(CashMovementRow & { type: "income" | "expense" })[]> {
  const { start, end } = monthRangeUtc(month);
  return findMovements({ createdById: userId, createdAt: { gte: start, lt: end } });
}

export type RentalPickerOption = {
  id: string;
  clientName: string;
  bookingId: string | null;
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
      label: `${r.clientName} — ${r.vehicle?.plate ?? "sin unidad"} (${formatDateInput(r.startAt)})${
        bookingId ? ` · #${bookingId}` : ""
      }`,
    };
  });
}

/**
 * Traduce las líneas de pago anotadas en la entrega/devolución (medio de pago
 * real, con % de ajuste y nota) a filas de `CashMovement` — un cobro por
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
    rentalId: opts.rentalId,
    createdById: opts.createdById,
  }));
}

export type CashMovementFieldChange = { field: string; from: string; to: string };

export type CashMovementEditRow = {
  id: string;
  action: "updated" | "deleted";
  changes: CashMovementFieldChange[] | null;
  editedByName: string;
  movementDescription: string;
  movementAmount: number;
  movementType: "income" | "expense";
  createdAt: Date;
};

/** Historial de ediciones/borrados de movimientos de Caja, del mes visible (por fecha de la edición). */
export async function getCashMonthEdits(month: string): Promise<CashMovementEditRow[]> {
  const { start, end } = monthRangeUtc(month);
  const rows = await prisma.cashMovementEdit.findMany({
    where: { createdAt: { gte: start, lt: end } },
    include: {
      editedBy: { select: { name: true } },
      cashMovement: { select: { description: true, amount: true, type: true } },
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
    movementType: r.cashMovement.type,
    createdAt: r.createdAt,
  }));
}
