import Link from "next/link";
import type { CalendarBar, CalendarColumn, CalendarNote, CalendarRow } from "@/lib/calendar";
import { formatTime } from "@/lib/datetime";
import { formatArs } from "@/lib/contract";
import { barClasses, paymentBorderClasses } from "./bar-style";
import { LABEL_W_CLASS } from "./calendar-constants";

export function Row({
  row,
  columns,
  trackW,
  colW,
  rowH,
  dense,
  activeKey,
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
  activeKey: string | null;
  onEnter: (bar: CalendarBar, e: React.MouseEvent) => void;
  onEnterNote: (title: string, notes: CalendarNote[], e: React.MouseEvent) => void;
  onMove: (e: React.MouseEvent) => void;
  onLeave: () => void;
}) {
  const hasNotes = row.activeNotes.length > 0;
  // Cuando hay alquileres solapados para este auto, la fila se hace
  // `laneCount` veces más alta (un carril por cada barra que se superpone en
  // fechas) para que ninguna tape a otra — ver assignLanes en src/lib/calendar.ts.
  const totalH = rowH * row.laneCount;
  return (
    <div className="flex border-b border-foreground/5 last:border-0">
      {/* Etiqueta del auto (fija a la izquierda), linkea al perfil del auto.
          Si el auto tiene un apodo cargado, es lo principal y alcanza (sin
          patente/modelo de secundario, para no duplicar la referencia en un
          espacio chico) — el precio va debajo. Sin apodo, la patente es lo
          principal y el modelo el secundario, como antes. Las filas sin
          unidad (plate null) no tienen perfil. */}
      {row.plate ? (
        <Link
          href={`/vehicles/${row.id}`}
          className={`sticky left-0 z-10 relative flex shrink-0 flex-col justify-center border-r border-foreground/10 bg-background px-3 transition-colors hover:bg-foreground/5 ${LABEL_W_CLASS}`}
          style={{ height: totalH }}
        >
          {hasNotes && (
            <span
              onMouseEnter={(e) => onEnterNote(row.name ?? row.plate!, row.activeNotes, e)}
              onMouseMove={onMove}
              onMouseLeave={onLeave}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEnterNote(row.name ?? row.plate!, row.activeNotes, e);
              }}
              className="absolute -right-1.5 -top-1.5 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold leading-none text-white shadow-sm"
              title={`${row.activeNotes.length} nota(s) sin resolver`}
            >
              {row.activeNotes.length}
            </span>
          )}
          {/* Mobile: apodo si tiene, si no los últimos 3 de la patente (columna
              angosta). Desktop (sm+): apodo o patente completa + secundario. */}
          <span className="truncate text-sm font-semibold leading-tight sm:hidden">
            {row.name ?? row.plate.slice(-3)}
          </span>
          <span className="hidden truncate text-sm font-semibold leading-tight sm:block">
            {row.name ?? row.plate}
          </span>
          {row.name ? null : (
            <span className="hidden truncate text-[11px] text-foreground/45 sm:block">
              {row.label}
            </span>
          )}
          {row.dailyRate != null ? (
            <span className="hidden truncate text-[11px] font-medium text-foreground/60 sm:block">
              {formatArs(row.dailyRate)}/día
            </span>
          ) : null}
        </Link>
      ) : (
        <div
          className={`sticky left-0 z-10 flex shrink-0 flex-col justify-center border-r border-foreground/10 bg-background px-3 ${LABEL_W_CLASS}`}
          style={{ height: totalH }}
        >
          <span className="truncate text-sm font-medium leading-tight">{row.label}</span>
        </div>
      )}

      {/* Track de días (rosa claro si el auto está fuera de servicio) */}
      <div
        className={`relative ${row.outOfService ? "bg-rose-500/10" : ""}`}
        style={{ width: trackW, height: totalH }}
      >
        {/* Líneas de grilla / resaltados por columna. Temporada con aumento
            (ver leyenda) se remarca aparte, encima del resto — es la que más
            importa detectar de un vistazo bajando por las filas. */}
        {columns.map((c, i) => (
          <div
            key={c.key}
            className={`absolute top-0 h-full border-r border-foreground/5 ${
              c.seasons.length > 0
                ? "bg-purple-500/[0.08]"
                : c.isToday
                  ? "bg-blue-500/[0.14]"
                  : c.isWeekend
                    ? "bg-foreground/[0.03]"
                    : ""
            }`}
            style={{ left: i * colW, width: colW }}
          />
        ))}
        {/* Barras de alquiler. En vista Semana (dense) hay lugar de sobra:
            se suma el horario de retiro/devolución debajo del cliente. */}
        {row.bars.map((bar) => {
          const isActive = activeKey === `bar:${bar.rentalId}`;
          return (
          <Link
            key={bar.rentalId}
            href={`/rentals/${bar.rentalId}`}
            onMouseEnter={(e) => onEnter(bar, e)}
            onMouseMove={onMove}
            onMouseLeave={onLeave}
            onClick={(e) => {
              // Touch: el primer toque muestra el tooltip en vez de navegar;
              // recién un segundo toque sobre la misma barra (ya activa) navega.
              if (isActive) return;
              e.preventDefault();
              e.stopPropagation();
              onEnter(bar, e);
            }}
            className={`absolute overflow-hidden rounded-md px-1.5 text-left font-medium shadow-sm transition-shadow hover:ring-2 ${
              dense ? "flex flex-col justify-center gap-0.5 py-1 text-xs" : "flex items-center text-[11px]"
            } ${barClasses(bar)} ${paymentBorderClasses(bar)}`}
            style={{
              left: bar.startIndex * colW + 2,
              width: bar.span * colW - 4,
              top: bar.lane * rowH + 6,
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
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onEnterNote(bar.clientName, bar.activeNotes, e);
                }}
                className="absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold leading-none text-white shadow-sm"
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
          );
        })}
      </div>
    </div>
  );
}
