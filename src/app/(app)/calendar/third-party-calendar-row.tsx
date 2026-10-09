import Link from "next/link";
import type { CalendarColumn, ThirdPartyCalendarBar, ThirdPartyCalendarRow } from "@/lib/calendar";
import { thirdPartyBarClasses } from "./bar-style";
import { LABEL_W_CLASS } from "./calendar-constants";

/**
 * Fila de un vehículo de tercero. Misma columna de día que los autos propios
 * (geometría de día entero, no media columna como Habitaciones) — es un auto
 * que se alquila igual que cualquier otro, solo que el dueño es un tercero.
 */
export function ThirdPartyRow({
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
  row: ThirdPartyCalendarRow;
  columns: CalendarColumn[];
  trackW: number;
  colW: number;
  rowH: number;
  activeKey: string | null;
  onEnter: (bar: ThirdPartyCalendarBar, e: React.MouseEvent) => void;
  onMove: (e: React.MouseEvent) => void;
  onLeave: () => void;
}) {
  const totalH = rowH * row.laneCount;
  return (
    <div className="flex border-b border-foreground/5 last:border-0">
      <Link
        href={`/third-party-vehicles/${row.id}`}
        className={`sticky left-0 z-10 flex shrink-0 flex-col justify-center border-r border-foreground/10 bg-background px-2 transition-colors hover:bg-foreground/5 sm:px-3 ${LABEL_W_CLASS}`}
        style={{ height: totalH }}
      >
        <span className="truncate text-sm font-semibold leading-tight">{row.plate}</span>
        <span className="hidden truncate text-[11px] text-foreground/45 sm:block">{row.label}</span>
        <span className="hidden truncate text-[11px] font-medium text-foreground/60 sm:block">{row.ownerName}</span>
      </Link>

      <div className="relative" style={{ width: trackW, height: totalH }}>
        {columns.map((c, i) => (
          <div
            key={c.key}
            title={c.special ? c.special.label : undefined}
            className={`absolute top-0 h-full border-r border-foreground/5 ${
              c.isToday ? "bg-blue-500/[0.14]" : c.special ? "bg-yellow-400/20" : c.isWeekend ? "bg-foreground/[0.03]" : ""
            }`}
            style={{ left: i * colW, width: colW }}
          />
        ))}
        {row.bars.map((bar) => {
          const isActive = activeKey === `thirdParty:${bar.bookingId}`;
          return (
            <Link
              key={bar.bookingId}
              href={`/third-party-vehicles/${bar.vehicleId}/bookings/${bar.bookingId}`}
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
              className={`absolute flex items-center overflow-hidden rounded-md px-1.5 text-left text-[11px] font-medium shadow-sm transition-shadow hover:ring-2 ${thirdPartyBarClasses()}`}
              style={{
                left: bar.startIndex * colW + 2,
                width: bar.span * colW - 4,
                top: bar.lane * rowH + 6,
                height: rowH - 12,
              }}
            >
              <span className="truncate">{bar.clientName}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
