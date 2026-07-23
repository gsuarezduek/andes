import type { CalendarBar, CalendarNote } from "@/lib/calendar";
import { formatDateTime } from "@/lib/datetime";
import { chipClasses, statusLabel } from "./bar-style";

export type HoverContent =
  | { type: "bar"; bar: CalendarBar }
  | { type: "notes"; title: string; notes: CalendarNote[] };
export type Hover = (HoverContent & { x: number; y: number }) | null;

export function Tooltip({ hover }: { hover: NonNullable<Hover> }) {
  const { x, y } = hover;
  // Se ubica cerca del cursor, corrido para no taparlo; fixed + pointer-events-none.
  const left = Math.min(x + 14, (typeof window !== "undefined" ? window.innerWidth : 9999) - 300);
  const top = y + 18;
  return (
    <div
      className="pointer-events-none fixed z-50 w-72 rounded-lg border border-foreground/15 bg-background p-3 text-xs shadow-xl"
      style={{ left, top }}
    >
      {hover.type === "notes" ? <NotesTooltipBody title={hover.title} notes={hover.notes} /> : <BarTooltipBody bar={hover.bar} />}
    </div>
  );
}

function BarTooltipBody({ bar }: { bar: CalendarBar }) {
  return (
    <>
      <p className="flex items-center gap-2 text-sm font-semibold">
        <span className="truncate">{bar.clientName}</span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${chipClasses(bar)}`}>
          {statusLabel(bar)}
        </span>
      </p>
      <p className="mt-0.5 text-foreground/60">
        {formatDateTime(bar.startAt)} → {formatDateTime(bar.endAt)}
        {bar.bookingModel ? ` · ${bar.bookingModel}` : ""}
      </p>
      {bar.extraDrivers.length > 0 ? (
        <p className="mt-1.5">
          <span className="text-foreground/45">Conductores adicionales: </span>
          {bar.extraDrivers.join(", ")}
        </p>
      ) : null}
      {bar.note ? (
        <p className="mt-1.5 whitespace-pre-wrap border-t border-foreground/10 pt-1.5 text-foreground/80">
          {bar.note}
        </p>
      ) : (
        <p className="mt-1.5 border-t border-foreground/10 pt-1.5 text-foreground/40">
          Sin notas de la reserva.
        </p>
      )}
    </>
  );
}

function NotesTooltipBody({ title, notes }: { title: string; notes: CalendarNote[] }) {
  return (
    <>
      <p className="flex items-center gap-2 text-sm font-semibold">
        <span className="truncate">{title}</span>
        <span className="shrink-0 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-400">
          {notes.length} nota{notes.length === 1 ? "" : "s"} sin resolver
        </span>
      </p>
      <ul className="mt-1.5 flex flex-col gap-1.5 border-t border-foreground/10 pt-1.5">
        {notes.map((n) => (
          <li key={n.id}>
            <p className="whitespace-pre-wrap text-foreground/80">{n.text}</p>
            <p className="text-foreground/45">
              {n.authorName ?? "—"} · {formatDateTime(n.createdAt)}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
