"use client";

import { useState } from "react";
import Link from "next/link";
import type { RentalStatus } from "@prisma/client";
import type { CalendarBar, CalendarColumn, CalendarNote, CalendarRow } from "@/lib/calendar";
import { formatDateTime, formatTime } from "@/lib/datetime";
import { rentalStatusDisplay } from "@/lib/rental-ui";

// Vista Mes: columnas angostas, sólo se ve qué días están ocupados.
const COL_W_MONTH = 46;
const ROW_H_MONTH = 40;
// Vista Semana: columnas bien más anchas — no es "el mismo mes recortado",
// hay lugar de sobra para mostrar el horario de retiro/devolución en la barra.
const COL_W_WEEK = 168;
const ROW_H_WEEK = 60;
/** A partir de esta cantidad de columnas se usa el layout compacto de Mes. */
const WEEK_MAX_COLUMNS = 7;

// Columna fija de autos: angosta en mobile (sólo los últimos 3 de la patente,
// sin modelo) y más ancha desde `sm:` (patente completa + modelo). El valor
// móvil se usa como piso conservador para el minWidth del contenido scrolleable.
const LABEL_W_MOBILE = 64;
const LABEL_W_CLASS = "w-16 sm:w-[168px]";

/** Etiqueta de estado para el tooltip: la "oficial" (src/lib/rental-ui), la
 *  misma que se usa en el listado de Alquileres y el detalle del alquiler. */
function statusLabel(bar: CalendarBar): string {
  return rentalStatusDisplay(bar.status as RentalStatus, bar.confirmed).label;
}

/** Clases de color de la barra según estado (ver leyenda en la página). */
function barClasses(bar: CalendarBar): string {
  switch (bar.status) {
    case "cancelled":
      return "bg-red-600/90 text-white hover:bg-red-600 hover:ring-red-300";
    case "active":
      return "bg-green-600/90 text-white hover:bg-green-600 hover:ring-green-300";
    case "finished":
      return "bg-slate-400/90 text-white hover:ring-slate-300";
    default: // reserved
      return bar.confirmed
        ? "bg-amber-400 text-amber-950 hover:bg-amber-400/90 hover:ring-amber-300" // Confirmado (pagado)
        : "bg-orange-500/90 text-white hover:bg-orange-500 hover:ring-orange-300"; // Pendiente
  }
}

/** Clases del chip de estado en el tooltip (fondo suave + texto). */
function chipClasses(bar: CalendarBar): string {
  switch (bar.status) {
    case "cancelled":
      return "bg-red-500/20 text-red-700 dark:text-red-400";
    case "active":
      return "bg-green-500/20 text-green-700 dark:text-green-400";
    case "finished":
      return "bg-slate-500/20 text-slate-600 dark:text-slate-300";
    default: // reserved
      return bar.confirmed
        ? "bg-amber-500/20 text-amber-700 dark:text-amber-500"
        : "bg-orange-500/20 text-orange-700 dark:text-orange-400";
  }
}

type HoverContent =
  | { type: "bar"; bar: CalendarBar }
  | { type: "notes"; title: string; notes: CalendarNote[] };
type Hover = (HoverContent & { x: number; y: number }) | null;

export function CalendarGrid({
  columns,
  rows,
  unassigned,
}: {
  columns: CalendarColumn[];
  rows: CalendarRow[];
  unassigned: CalendarRow[];
}) {
  const [hover, setHover] = useState<Hover>(null);
  const dense = columns.length <= WEEK_MAX_COLUMNS;
  const colW = dense ? COL_W_WEEK : COL_W_MONTH;
  const rowH = dense ? ROW_H_WEEK : ROW_H_MONTH;
  const trackW = columns.length * colW;

  const show = (bar: CalendarBar, e: React.MouseEvent) =>
    setHover({ type: "bar", bar, x: e.clientX, y: e.clientY });
  const showNotes = (title: string, notes: CalendarNote[], e: React.MouseEvent) =>
    setHover({ type: "notes", title, notes, x: e.clientX, y: e.clientY });
  const move = (e: React.MouseEvent) =>
    setHover((h) => (h ? { ...h, x: e.clientX, y: e.clientY } : h));
  const hide = () => setHover(null);

  return (
    <div className="relative rounded-xl border border-foreground/10">
      <div className="overflow-x-auto">
        <div style={{ minWidth: LABEL_W_MOBILE + trackW }}>
          {/* Encabezado de días */}
          <div className="flex border-b border-foreground/10">
            <div
              className={`sticky left-0 z-20 shrink-0 truncate border-r border-foreground/10 bg-background px-3 py-2 text-xs font-semibold text-foreground/50 ${LABEL_W_CLASS}`}
            >
              Vehículo
            </div>
            {columns.map((c) => (
              <div
                key={c.key}
                className={`relative shrink-0 py-1 text-center ${
                  c.isWeekend ? "bg-foreground/[0.04]" : ""
                } ${c.isToday ? "bg-blue-500/10" : ""}`}
                style={{ width: colW }}
              >
                {c.monthLabel ? (
                  <span className="absolute -top-0 left-1 text-[9px] font-semibold uppercase text-blue-600">
                    {c.monthLabel}
                  </span>
                ) : null}
                <div className={`uppercase ${dense ? "text-xs" : "text-[10px]"} ${c.isToday ? "font-bold text-blue-600" : "text-foreground/40"}`}>
                  {c.weekday}
                </div>
                <div className={`tabular-nums ${dense ? "text-xl" : "text-sm"} ${c.isToday ? "font-bold text-blue-600" : "text-foreground/70"}`}>
                  {c.day}
                </div>
              </div>
            ))}
          </div>

          {/* Filas de vehículos */}
          {rows.map((row) => (
            <Row
              key={row.id}
              row={row}
              columns={columns}
              trackW={trackW}
              colW={colW}
              rowH={rowH}
              dense={dense}
              onEnter={show}
              onEnterNote={showNotes}
              onMove={move}
              onLeave={hide}
            />
          ))}

          {rows.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-foreground/50">
              No hay vehículos en la flota.
            </div>
          ) : null}

          {/* Reservas sin unidad asignada */}
          {unassigned.length > 0 ? (
            <>
              <div className="flex border-t border-foreground/10 bg-foreground/[0.03]">
                <div
                  className={`sticky left-0 z-10 shrink-0 truncate bg-foreground/[0.03] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground/50 ${LABEL_W_CLASS}`}
                >
                  <span className="sm:hidden">Sin unidad</span>
                  <span className="hidden sm:inline">Sin unidad asignada</span>
                </div>
                <div style={{ width: trackW }} />
              </div>
              {unassigned.map((row) => (
                <Row
                  key={row.id}
                  row={row}
                  columns={columns}
                  trackW={trackW}
                  colW={colW}
                  rowH={rowH}
                  dense={dense}
                  onEnter={show}
                  onEnterNote={showNotes}
                  onMove={move}
                  onLeave={hide}
                />
              ))}
            </>
          ) : null}
        </div>
      </div>

      {hover ? <Tooltip hover={hover} /> : null}
    </div>
  );
}

function Row({
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

function Tooltip({ hover }: { hover: NonNullable<Hover> }) {
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
