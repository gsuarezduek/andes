import { formatArs } from "@/lib/contract";

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
