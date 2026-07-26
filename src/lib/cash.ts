import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatDateInput, mendozaWallTimeToUtc } from "@/lib/datetime";

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
  paymentMethodName: string;
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
    where,
    include: { createdBy: { select: { name: true } }, rental: { select: { clientName: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(
    (r): CashMovementRow & { type: "income" | "expense" } => ({
      id: r.id,
      type: r.type,
      description: r.description,
      amount: Number(r.amount),
      paymentMethodName: r.paymentMethodName,
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
