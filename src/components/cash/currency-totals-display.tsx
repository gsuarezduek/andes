import { formatMoney } from "@/lib/contract";
import type { CurrencyTotals } from "@/lib/currency";

/**
 * Total separado por moneda: pesos siempre (aunque sea $0, es la moneda por
 * defecto), dólares solo si hay algo cargado en esa moneda en el período —
 * nunca se suman entre sí (mezclarlas daría una cifra sin sentido).
 */
export function CurrencyTotalsDisplay({
  totals,
  toneClass = "",
  size = "text-lg",
}: {
  totals: CurrencyTotals;
  toneClass?: string;
  size?: string;
}) {
  return (
    <>
      <p className={`${size} font-semibold ${toneClass}`}>{formatMoney(totals.ars, "ars")}</p>
      {totals.usd !== 0 && <p className={`text-sm font-medium ${toneClass}`}>{formatMoney(totals.usd, "usd")}</p>}
    </>
  );
}
