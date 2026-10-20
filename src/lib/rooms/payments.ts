import type { Currency } from "@/lib/currency";
import { usdRateAt, type UsdRatePoint } from "@/lib/usd-rate";

export type RoomPaymentForBalance = {
  amount: number;
  currency: Currency;
  /** Pesos por dólar pactados en ese cobro (si se guardó). */
  exchangeRate: number | null;
  createdAt: Date;
};

/** Monto de un cobro expresado en `target`, o `null` si no hay cotización para convertirlo. */
export function paymentInCurrency(
  p: RoomPaymentForBalance,
  target: Currency,
  history: UsdRatePoint[],
): number | null {
  if (p.currency === target) return p.amount;
  const rate = p.exchangeRate ?? usdRateAt(history, p.createdAt);
  if (rate == null || rate <= 0) return null;
  return target === "usd" ? p.amount / rate : p.amount * rate;
}

/**
 * Total cobrado de una estadía en la moneda de su total. Un cobro en la otra
 * moneda se convierte con la cotización guardada en el cobro, o con el valor
 * de referencia del USD a su fecha. `unconverted` cuenta los que no se
 * pudieron convertir (sin ningún valor de referencia cargado). Pura.
 */
export function roomPaidTotal(
  payments: RoomPaymentForBalance[],
  target: Currency,
  history: UsdRatePoint[],
): { paid: number; unconverted: number } {
  let paid = 0;
  let unconverted = 0;
  for (const p of payments) {
    const v = paymentInCurrency(p, target, history);
    if (v == null) unconverted++;
    else paid += v;
  }
  return { paid, unconverted };
}
