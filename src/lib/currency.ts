/**
 * Moneda de un movimiento de Caja o Caja fuerte. Por defecto siempre pesos
 * argentinos — dólares es la excepción. Sin conversión entre ambas: los
 * totales se calculan y muestran separados por moneda, nunca sumados entre
 * sí (mezclar $ARS y US$ en una sola cifra sería directamente incorrecto).
 */
export type Currency = "ars" | "usd";

export const CURRENCIES: Currency[] = ["ars", "usd"];

export const currencyLabels: Record<Currency, string> = {
  ars: "Pesos (ARS)",
  usd: "Dólares (USD)",
};

export type CurrencyTotals = Record<Currency, number>;

export function emptyCurrencyTotals(): CurrencyTotals {
  return { ars: 0, usd: 0 };
}

/** Suma `amount` agrupado por `currency` — nunca entre monedas distintas. */
export function sumByCurrency<T extends { currency: Currency; amount: number }>(rows: T[]): CurrencyTotals {
  const totals = emptyCurrencyTotals();
  for (const r of rows) totals[r.currency] += r.amount;
  return totals;
}
