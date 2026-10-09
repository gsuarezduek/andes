import type { CalendarBar, CalendarColumnSeason, CalendarNote, CalendarQuoteBar, RoomCalendarBar } from "@/lib/calendar";
import { formatDateTime } from "@/lib/datetime";
import { formatArs, formatMoney } from "@/lib/contract";
import { roomSourceLabels } from "@/lib/rooms/feed-url";
import { chipClasses, quoteChipClasses, roomChipClasses, statusLabel } from "./bar-style";

export type HoverContent =
  | { type: "bar"; bar: CalendarBar }
  | { type: "notes"; title: string; notes: CalendarNote[] }
  | { type: "season"; seasons: CalendarColumnSeason[] }
  | { type: "quote"; quote: CalendarQuoteBar }
  | { type: "room"; room: RoomCalendarBar; checkIn: string; checkOut: string };
export type Hover = (HoverContent & { x: number; y: number }) | null;

export function Tooltip({ hover }: { hover: NonNullable<Hover> }) {
  const { x, y } = hover;
  // Se ubica cerca del cursor, corrido para no taparlo; fixed + pointer-events-none.
  const left = Math.min(x + 14, (typeof window !== "undefined" ? window.innerWidth : 9999) - 300);
  // En la mitad de abajo de la pantalla (ej. las filas de habitaciones, al
  // final de la grilla) el tooltip se abre hacia arriba para no quedar cortado.
  const openUp = typeof window !== "undefined" && y > window.innerHeight * 0.6;
  const position = openUp ? { bottom: window.innerHeight - y + 18 } : { top: y + 18 };
  return (
    <div
      className="pointer-events-none fixed z-50 w-72 rounded-lg border border-foreground/15 bg-background p-3 text-xs shadow-xl"
      style={{ left, ...position }}
    >
      {hover.type === "notes" ? (
        <NotesTooltipBody title={hover.title} notes={hover.notes} />
      ) : hover.type === "season" ? (
        <SeasonTooltipBody seasons={hover.seasons} />
      ) : hover.type === "quote" ? (
        <QuoteTooltipBody quote={hover.quote} />
      ) : hover.type === "room" ? (
        <RoomTooltipBody room={hover.room} checkIn={hover.checkIn} checkOut={hover.checkOut} />
      ) : (
        <BarTooltipBody bar={hover.bar} />
      )}
    </div>
  );
}

function QuoteTooltipBody({ quote }: { quote: CalendarQuoteBar }) {
  return (
    <>
      <p className="flex items-center gap-2 text-sm font-semibold">
        <span className="truncate">{quote.clientName ?? "Presupuesto"}</span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${quoteChipClasses()}`}>
          Presupuesto
        </span>
      </p>
      {quote.estimatedTotal != null ? (
        <p className="mt-1 font-medium text-orange-700 dark:text-orange-400">
          Estimado: {formatArs(quote.estimatedTotal)}
        </p>
      ) : null}
      <p className="mt-1 text-foreground/60">
        {quote.createdByName ? `Cargado por ${quote.createdByName}` : "Cargado por un compañero"}
      </p>
      {quote.conversationId ? (
        <p className="mt-1 text-foreground/60">
          🔗 Conversación de WhatsApp vinculada{quote.conversationLabel ? ` (${quote.conversationLabel})` : ""}
        </p>
      ) : null}
      {quote.note ? (
        <p className="mt-1.5 whitespace-pre-wrap border-t border-foreground/10 pt-1.5 text-foreground/80">
          {quote.note}
        </p>
      ) : null}
      <p className="mt-1.5 border-t border-foreground/10 pt-1.5 text-foreground/40">
        Tocá la barra para ver el detalle.
      </p>
    </>
  );
}

/** "2026-09-30" → "30/09". */
const shortKey = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;

function RoomTooltipBody({ room, checkIn, checkOut }: { room: RoomCalendarBar; checkIn: string; checkOut: string }) {
  const remaining = room.totalAmount > 0 ? room.totalAmount - room.paid : null;
  return (
    <>
      <p className="flex items-center gap-2 text-sm font-semibold">
        <span className="truncate">{room.guest}</span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${roomChipClasses(room)}`}>
          {room.isBlock ? "Bloqueo" : roomSourceLabels[room.source]}
        </span>
      </p>
      <p className="mt-0.5 text-foreground/60">
        Entra {shortKey(room.startDate)} {checkIn} → sale {shortKey(room.endDate)} {checkOut} · {room.nights} noche
        {room.nights === 1 ? "" : "s"}
      </p>
      {room.totalAmount > 0 ? (
        <p className="mt-1 font-medium">
          {formatMoney(room.totalAmount, room.currency)}
          {remaining != null && remaining <= 0 ? (
            <span className="text-emerald-600 dark:text-emerald-400"> · pagada</span>
          ) : (
            <span className="text-red-600 dark:text-red-400"> · falta {formatMoney(remaining, room.currency)}</span>
          )}
        </p>
      ) : null}
      {room.notes ? (
        <p className="mt-1.5 whitespace-pre-wrap border-t border-foreground/10 pt-1.5 text-foreground/80">{room.notes}</p>
      ) : (
        <p className="mt-1.5 border-t border-foreground/10 pt-1.5 text-foreground/40">
          {room.externalLabel ? `Calendario: ${room.externalLabel}` : "Sin notas."}
        </p>
      )}
    </>
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
      {bar.paymentAccent === "complete" ? (
        <p className="mt-1 font-medium text-emerald-600 dark:text-emerald-400">Pagado completo</p>
      ) : bar.paymentAccent === "pending" ? (
        <p className="mt-1 font-medium text-red-600 dark:text-red-400">
          Falta pagar {formatArs(bar.balance)}
        </p>
      ) : null}
      {bar.verified ? (
        <p className="mt-1 font-medium text-emerald-600 dark:text-emerald-400">
          Verificada{bar.verifiedByName ? ` por ${bar.verifiedByName}` : ""}
          {bar.verifiedAt ? ` · ${formatDateTime(bar.verifiedAt)}` : ""}
        </p>
      ) : null}
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

/** "2026-07-18" → "18/07". */
function fmtShortDate(s: string): string {
  const [, m, d] = s.split("-");
  return `${d}/${m}`;
}

function SeasonTooltipBody({ seasons }: { seasons: CalendarColumnSeason[] }) {
  return (
    <>
      <p className="flex items-center gap-2 text-sm font-semibold">
        <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-purple-500" />
        <span>Temporada con aumento</span>
      </p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {seasons.map((s, i) => (
          <li key={i} className="text-foreground/80">
            +{s.diffPercent}% · {fmtShortDate(s.from)} al {fmtShortDate(s.to)}
          </li>
        ))}
      </ul>
      <p className="mt-1.5 border-t border-foreground/10 pt-1.5 text-foreground/40">
        Tarifa de VikRentCar — aplica a toda la flota.
      </p>
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
