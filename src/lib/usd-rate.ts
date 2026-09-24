import type { Currency } from "@/lib/currency";

export type UsdRatePoint = { rate: number; createdAt: Date };

/**
 * Valor de referencia del USD vigente en `at`: el último cargado hasta esa
 * fecha. Si el movimiento es anterior a cualquier valor cargado (datos previos
 * a esta función), se usa el primero disponible — pedido del dueño. Sin
 * ningún valor cargado devuelve `null`. `history` debe venir ordenado por
 * fecha ascendente. Pura y testeable.
 */
export function usdRateAt(history: UsdRatePoint[], at: Date): number | null {
  if (history.length === 0) return null;
  let found = history[0].rate;
  for (const point of history) {
    if (point.createdAt.getTime() <= at.getTime()) found = point.rate;
    else break;
  }
  return found;
}

/**
 * Pasa un monto a pesos. ARS queda igual; USD se multiplica por `rate`. Sin
 * valor de referencia (`null`) un USD no se puede convertir: devuelve `null`
 * para que el llamador decida (Reportes lo deja afuera en vez de sumarlo como
 * si fueran pesos).
 */
export function toArs(amount: number, currency: Currency, rate: number | null): number | null {
  if (currency === "ars") return amount;
  return rate == null ? null : amount * rate;
}
