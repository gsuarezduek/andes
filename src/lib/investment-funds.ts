import { emptyCurrencyTotals, type Currency, type CurrencyTotals } from "@/lib/currency";
import { formatDateInput } from "@/lib/datetime";

export type FundMovementAmount = {
  type: "deposit" | "withdrawal";
  amount: number;
  currency: Currency;
  createdAt: Date;
};

/** Saldo actual de un fondo (depósitos − retiros), histórico completo. Pura. */
export function fundBalance(movements: FundMovementAmount[]): CurrencyTotals {
  const totals = emptyCurrencyTotals();
  for (const m of movements) totals[m.currency] += m.type === "deposit" ? m.amount : -m.amount;
  return totals;
}

/**
 * Saldo acumulado del fondo al cierre de un mes calendario (hora Mendoza,
 * `monthKey` "YYYY-MM") — para la línea "En Fondos" del resumen mensual de la
 * cuenta. Compara lexicográficamente, válido porque "YYYY-MM" ordena igual
 * que la fecha real. Pura.
 */
export function fundBalanceAtMonthEnd(movements: FundMovementAmount[], monthKey: string): CurrencyTotals {
  const totals = emptyCurrencyTotals();
  for (const m of movements) {
    if (formatDateInput(m.createdAt).slice(0, 7) > monthKey) continue;
    totals[m.currency] += m.type === "deposit" ? m.amount : -m.amount;
  }
  return totals;
}
