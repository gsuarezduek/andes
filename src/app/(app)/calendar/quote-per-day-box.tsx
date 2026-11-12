import { formatArs } from "@/lib/contract";
import { priceOptionLabel, quotePriceOptions, type PaymentPriceAdjustment } from "@/lib/quote-price-options";

/** Precio por día de un presupuesto (total ÷ días completos), destacado
 *  para poder decírselo al cliente de un vistazo. Compartido por el alta y
 *  el detalle. `extra` (horas extra + su importe, parte del sugerido) es
 *  solo informativo — no se recalcula si el total se edita a mano. */
export function PerDayBox({
  perDay,
  days,
  extra,
}: {
  perDay: number;
  days: number;
  extra?: { hours: number; amount: number } | null;
}) {
  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
      <p className="text-xs text-foreground/60">Precio por día</p>
      <p className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{formatArs(perDay)}</p>
      <p className="text-xs text-foreground/50">
        {days} día{days === 1 ? "" : "s"}
        {extra && extra.hours > 0
          ? ` + ${extra.hours} hora${extra.hours === 1 ? "" : "s"} extra (${formatArs(extra.amount)})`
          : ""}
      </p>
    </div>
  );
}

/** Precio del presupuesto según la forma de pago (descuentos de VikRentCar,
 *  ver `quotePriceOptions`): primero el precio con descuento, aclarando con
 *  qué medios, y después el de lista para el resto. Sin descuentos cargados,
 *  el mismo `PerDayBox` de siempre. `total` es el de lista. */
export function QuotePriceBox({
  total,
  days,
  adjustments,
  extra,
}: {
  total: number;
  days: number;
  adjustments: PaymentPriceAdjustment[];
  extra?: { hours: number; amount: number } | null;
}) {
  const options = quotePriceOptions(total, days, adjustments);
  if (options.length <= 1) {
    const perDay = options[0]?.perDay;
    return perDay != null ? <PerDayBox perDay={perDay} days={days} extra={extra} /> : null;
  }
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
      <p className="text-xs text-foreground/60">Precio por día según forma de pago</p>
      {options.map((o) => {
        const label = priceOptionLabel(o);
        const highlight = o.kind === "discount";
        return (
          <div key={`${o.kind}-${o.adjustmentLabel}`}>
            <p
              className={
                highlight
                  ? "text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400"
                  : "text-lg font-semibold tabular-nums text-foreground/80"
              }
            >
              {o.perDay != null ? formatArs(o.perDay) : "—"}
              <span className="ml-1 text-xs font-normal text-foreground/50">por día</span>
            </p>
            <p className="text-xs text-foreground/60">
              {label.charAt(0).toUpperCase()}
              {label.slice(1)} · Total {formatArs(o.total)}
            </p>
          </div>
        );
      })}
      <p className="text-xs text-foreground/50">
        {days} día{days === 1 ? "" : "s"}
        {extra && extra.hours > 0
          ? ` + ${extra.hours} hora${extra.hours === 1 ? "" : "s"} extra (${formatArs(extra.amount)}, a precio de lista)`
          : ""}
      </p>
    </div>
  );
}
