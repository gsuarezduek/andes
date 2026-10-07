import Link from "next/link";
import type { CalendarColumn, RoomCalendarBar, RoomCalendarRow } from "@/lib/calendar";
import { formatArs } from "@/lib/contract";
import { roomBarClasses } from "./bar-style";
import { LABEL_W_CLASS } from "./calendar-constants";

/**
 * Fila de una habitación. Igual que la de un auto (mismas columnas de día),
 * pero las barras van de mediodía a mediodía: la salida de una estadía y la
 * entrada de la siguiente el mismo día quedan lado a lado, sin pisarse.
 */
export function RoomRow({
  row,
  columns,
  trackW,
  colW,
  rowH,
  activeKey,
  onEnter,
  onMove,
  onLeave,
}: {
  row: RoomCalendarRow;
  columns: CalendarColumn[];
  trackW: number;
  colW: number;
  rowH: number;
  activeKey: string | null;
  onEnter: (bar: RoomCalendarBar, e: React.MouseEvent) => void;
  onMove: (e: React.MouseEvent) => void;
  onLeave: () => void;
}) {
  const totalH = rowH * row.laneCount;
  const half = colW / 2;
  return (
    <div className="flex border-b border-foreground/5 last:border-0">
      <Link
        href={`/rooms/${row.id}`}
        className={`sticky left-0 z-10 flex shrink-0 flex-col justify-center border-r border-foreground/10 bg-background px-3 transition-colors hover:bg-foreground/5 ${LABEL_W_CLASS}`}
        style={{ height: totalH }}
      >
        {/* Mobile: columna angosta, "Habitación 1" → "Hab. 1". */}
        <span className="truncate text-xs font-semibold leading-tight sm:hidden">
          {row.name.replace(/^habitaci[oó]n\s+/i, "Hab. ")}
        </span>
        <span className="hidden truncate text-sm font-semibold leading-tight sm:block">{row.name}</span>
        {row.nightlyRate != null ? (
          <span className="hidden truncate text-[11px] font-medium text-foreground/60 sm:block">{formatArs(row.nightlyRate)}/noche</span>
        ) : null}
      </Link>

      <div className="relative" style={{ width: trackW, height: totalH }}>
        {columns.map((c, i) => (
          <div
            key={c.key}
            className={`absolute top-0 h-full border-r border-foreground/5 ${
              c.isToday ? "bg-blue-500/[0.14]" : c.isWeekend ? "bg-foreground/[0.03]" : ""
            }`}
            style={{ left: i * colW, width: colW }}
          />
        ))}
        {row.bars.map((bar) => {
          const isActive = activeKey === `room:${bar.bookingId}`;
          return (
            <Link
              key={bar.bookingId}
              href={`/rooms/${bar.roomId}/bookings/${bar.bookingId}`}
              onMouseEnter={(e) => onEnter(bar, e)}
              onMouseMove={onMove}
              onMouseLeave={onLeave}
              onClick={(e) => {
                // Touch: el primer toque muestra el tooltip; el segundo navega.
                if (isActive) return;
                e.preventDefault();
                e.stopPropagation();
                onEnter(bar, e);
              }}
              className={`absolute flex items-center overflow-hidden px-1.5 text-left text-[11px] font-medium shadow-sm transition-shadow hover:ring-2 ${
                bar.clippedStart ? "rounded-l-none" : "rounded-l-md"
              } ${bar.clippedEnd ? "rounded-r-none" : "rounded-r-md"} ${roomBarClasses(bar)}`}
              style={{
                left: bar.startIndex * half + 1,
                width: bar.span * half - 2,
                top: bar.lane * rowH + 6,
                height: rowH - 12,
              }}
            >
              <span className="truncate">{bar.guest}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
