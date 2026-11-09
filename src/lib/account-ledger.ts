import { emptyCurrencyTotals, fiatCurrency, type CurrencyTotals } from "@/lib/currency";
import type { CashMovementRow } from "@/lib/cash";
import type { AccountTransferRow } from "@/lib/account-transfers-queries";

/**
 * Una línea del historial mensual de una cuenta propia (`/caja/saldos/[id]`):
 * un ingreso/egreso de Caja, o un traspaso visto desde esta cuenta ("in" =
 * entra plata, va con los ingresos; "out" = sale, va con los egresos).
 */
export type AccountLedgerEntry =
  | { kind: "movement"; createdAt: Date; movement: CashMovementRow }
  | { kind: "transfer"; createdAt: Date; direction: "in" | "out"; transfer: AccountTransferRow };

/**
 * Junta los movimientos de la cuenta con sus traspasos, más reciente primero
 * (lo que espera `groupProviderLedgerByMonth`). `accountIds` = la cuenta y
 * sus subcuentas: un traspaso entre dos de ellas aparece de los dos lados
 * (sale y entra), así el mes no cambia. Pura y testeable.
 */
export function buildAccountLedgerEntries(
  movements: CashMovementRow[],
  transfers: AccountTransferRow[],
  accountIds: string[],
): AccountLedgerEntry[] {
  const ids = new Set(accountIds);
  const entries: AccountLedgerEntry[] = movements.map((m) => ({ kind: "movement", createdAt: m.createdAt, movement: m }));
  for (const t of transfers) {
    if (t.fromAccountId !== null && ids.has(t.fromAccountId)) {
      entries.push({ kind: "transfer", createdAt: t.createdAt, direction: "out", transfer: t });
    }
    if (t.toAccountId !== null && ids.has(t.toAccountId)) {
      entries.push({ kind: "transfer", createdAt: t.createdAt, direction: "in", transfer: t });
    }
  }
  return entries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Lo que entró y salió de la cuenta en un conjunto de líneas (un mes),
 * incluidos los traspasos con el monto del lado de esta cuenta. El lado en
 * BTC de un traspaso no suma: es de una cuenta Bitcoin, que no usa esta
 * vista. Pura y testeable.
 */
export function accountLedgerTotals(entries: AccountLedgerEntry[]): { income: CurrencyTotals; expense: CurrencyTotals } {
  const income = emptyCurrencyTotals();
  const expense = emptyCurrencyTotals();
  for (const e of entries) {
    if (e.kind === "movement") {
      if (e.movement.type === "income") income[e.movement.currency] += e.movement.amount;
      else if (e.movement.type === "expense") expense[e.movement.currency] += e.movement.amount;
      continue;
    }
    const t = e.transfer;
    const currency = fiatCurrency(e.direction === "in" ? t.toCurrency : t.fromCurrency);
    if (!currency) continue;
    if (e.direction === "in") income[currency] += t.toAmount;
    else expense[currency] += t.fromAmount;
  }
  return { income, expense };
}
