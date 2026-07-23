import Link from "next/link";
import type { CalendarBar, CalendarColumn, CalendarNote, CalendarRow } from "@/lib/calendar";
import { formatTime } from "@/lib/datetime";
import { barClasses } from "./bar-style";
import { LABEL_W_CLASS } from "./calendar-constants";

export function Row({
  row,
  columns,
  trackW,
  colW,
  rowH,
  dense,
  onEnter,
  onEnterNote,
  onMove,
  onLeave,
}: {
  row: CalendarRow;
  columns: CalendarColumn[];
  trackW: number;
  colW: number;
  rowH: number;
  dense: boolean;
  onEnter: (bar: CalendarBar, e: React.MouseEvent) => void;
  onEnterNote: (title: string, notes: CalendarNote[], e: React.MouseEvent) => void;
  onMove: (e: React.MouseEvent) => void;
  onLeave: () => void;
}) {
  const hasNotes = row.activeNotes.length > 0;
  return (
    <div className="flex border-b border-foreground/5 last:border-0">
      {/* Etiqueta del auto (fija a la izquierda). En filas de vehículo la
          patente es lo principal y el modelo el secundario, y linkea al perfil
          del auto. Las filas sin unidad (plate null) no tienen perfil. */}
      {row.plate ? (
        <Link
          href={`/vehicles/${row.id}`}
          className={`sticky left-0 z-10 relative flex shrink-0 flex-col justify-center border-r border-foreground/10 bg-background px-3 transition-colors hover:bg-foreground/5 ${LABEL_W_CLASS}`}
          style={{ height: rowH }}
        >
          {hasNotes && (
            <span
              onMouseEnter={(e) => onEnterNote(row.plate!, row.activeNotes, e)}
              onMouseMove={onMove}
              onMouseLeave={onLeave}
              className="absolute right-2 top-1.5 z-20 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold leading-none text-white shadow-sm"
              title={`${row.activeNotes.length} nota(s) sin resolver`}
            >
              {row.activeNotes.length}
            </span>
          )}
          {/* Mobile: sólo los últimos 3 de la patente, sin modelo (columna angosta).
              Desktop (sm+): patente completa + modelo. */}
          <span className="truncate text-sm font-semibold leading-tight sm:hidden">
            {row.plate.slice(-3)}
          </span>
          <span className="hidden truncate text-sm font-semibold leading-tight sm:block">
            {row.plate}
          </span>
          <span className="hidden truncate text-[11px] text-foreground/45 sm:block">{row.label}</span>
        </Link>
      ) : (
        <div
          className={`sticky left-0 z-10 flex shrink-0 flex-col justify-center border-r border-foreground/10 bg-background px-3 ${LABEL_W_CLASS}`}
          style={{ height: rowH }}
        >
          <span className="truncate text-sm font-medium leading-tight">{row.label}</span>
        </div>
      )}

      {/* Track de días (rosa claro si el auto está fuera de servicio) */}
      <div
        className={`relative ${row.outOfService ? "bg-rose-500/10" : ""}`}
        style={{ width: trackW, height: rowH }}
      >
        {/* Líneas de grilla / resaltados por columna */}
        {columns.map((c, i) => (
          <div
            key={c.key}
            className={`absolute top-0 h-full border-r border-foreground/5 ${
              c.isWeekend ? "bg-foreground/[0.03]" : ""
            } ${c.isToday ? "bg-blue-500/[0.07]" : ""}`}
            style={{ left: i * colW, width: colW }}
          />
        ))}
        {/* Barras de alquiler. En vista Semana (dense) hay lugar de sobra:
            se suma el horario de retiro/devolución debajo del cliente. */}
        {row.bars.map((bar) => (
          <Link
            key={bar.rentalId}
            href={`/rentals/${bar.rentalId}`}
            onMouseEnter={(e) => onEnter(bar, e)}
            onMouseMove={onMove}
            onMouseLeave={onLeave}
            className={`absolute overflow-hidden rounded-md px-1.5 text-left font-medium shadow-sm transition-shadow hover:ring-2 ${
              dense ? "flex flex-col justify-center gap-0.5 py-1 text-xs" : "flex items-center text-[11px]"
            } ${barClasses(bar)}`}
            style={{
              left: bar.startIndex * colW + 2,
              width: bar.span * colW - 4,
              top: 6,
              height: rowH - 12,
            }}
          >
            {bar.activeNotes.length > 0 && (
              <span
                onMouseEnter={(e) => {
                  e.stopPropagation();
                  onEnterNote(bar.clientName, bar.activeNotes, e);
                }}
                onMouseMove={(e) => {
                  e.stopPropagation();
                  onMove(e);
                }}
                onMouseLeave={(e) => {
                  e.stopPropagation();
                  onEnter(bar, e);
                }}
                className="absolute right-0 top-0 z-10 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold leading-none text-white shadow-sm"
                title={`${bar.activeNotes.length} nota(s) sin resolver`}
              >
                {bar.activeNotes.length}
              </span>
            )}
            <span className="truncate">{bar.clientName}</span>
            {dense ? (
              <span className="truncate text-[11px] font-normal opacity-90">
                {formatTime(bar.startAt)} → {formatTime(bar.endAt)}
              </span>
            ) : null}
          </Link>
        ))}
      </div>
    </div>
  );
}
