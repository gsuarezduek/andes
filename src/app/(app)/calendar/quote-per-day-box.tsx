import { formatArs } from "@/lib/contract";

/** Precio por día de un presupuesto (total ÷ días), destacado para poder
 *  decírselo al cliente de un vistazo. Compartido por el alta y el detalle. */
export function PerDayBox({ perDay, days }: { perDay: number; days: number }) {
  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
      <p className="text-xs text-foreground/60">Precio por día</p>
      <p className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{formatArs(perDay)}</p>
      <p className="text-xs text-foreground/50">
        {days} día{days === 1 ? "" : "s"}
      </p>
    </div>
  );
}
