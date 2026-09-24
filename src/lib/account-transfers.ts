import { emptyCurrencyTotals, type Currency, type CurrencyTotals } from "@/lib/currency";

/** Id que usa el form de traspasos para la Caja fuerte (no es un `PaymentMethod`; se guarda como cuenta nula). */
export const SAFE_ACCOUNT_ID = "safe";
export const SAFE_ACCOUNT_NAME = "Caja fuerte";

/**
 * Lo mínimo de un traspaso para calcular saldos (ver `AccountTransfer`). Una
 * cuenta `null` es la Caja fuerte (efectivo físico), que no es un medio de pago.
 */
export type TransferAmounts = {
  fromAccountId: string | null;
  fromAmount: number;
  fromCurrency: Currency;
  toAccountId: string | null;
  toAmount: number;
  toCurrency: Currency;
};

/**
 * Aplica traspasos a los saldos por cuenta principal: resta `fromAmount` en la
 * cuenta origen y suma `toAmount` en la destino, cada uno en su moneda.
 * `resolve` lleva cada cuenta (o subcuenta) a su principal; un traspaso entre
 * subcuentas de la misma principal se cancela solo. Muta `balances`. Pura y
 * testeable.
 */
export function applyTransfersToBalances(
  balances: Map<string, CurrencyTotals>,
  resolve: Map<string, string>,
  transfers: TransferAmounts[],
): void {
  for (const t of transfers) {
    const from = balances.get(resolve.get(t.fromAccountId ?? "") ?? "");
    if (from) from[t.fromCurrency] -= t.fromAmount;
    const to = balances.get(resolve.get(t.toAccountId ?? "") ?? "");
    if (to) to[t.toCurrency] += t.toAmount;
  }
}

/**
 * Efecto neto de los traspasos sobre la Billetera (efectivo en mano): lo que
 * sale de una cuenta `isCash` resta, lo que entra a una suma. Un traspaso
 * entre dos cuentas `isCash` (o ninguna) no la mueve. Pura y testeable.
 */
export function walletDeltaFromTransfers(
  transfers: (TransferAmounts & { fromIsCash: boolean; toIsCash: boolean })[],
): CurrencyTotals {
  const delta = emptyCurrencyTotals();
  for (const t of transfers) {
    if (t.fromIsCash) delta[t.fromCurrency] -= t.fromAmount;
    if (t.toIsCash) delta[t.toCurrency] += t.toAmount;
  }
  return delta;
}

/**
 * Efecto neto de los traspasos sobre el saldo de la Caja fuerte: lo que entra
 * (destino `null`) suma, lo que sale (origen `null`) resta. Pura y testeable.
 */
export function safeDeltaFromTransfers(transfers: TransferAmounts[]): CurrencyTotals {
  const delta = emptyCurrencyTotals();
  for (const t of transfers) {
    if (t.toAccountId === null) delta[t.toCurrency] += t.toAmount;
    if (t.fromAccountId === null) delta[t.fromCurrency] -= t.fromAmount;
  }
  return delta;
}
