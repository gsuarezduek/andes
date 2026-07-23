"use client";

import { useState } from "react";
import Link from "next/link";
import type { CalendarBar, CalendarColumn, CalendarRow } from "@/lib/calendar";
import { formatDateTime } from "@/lib/datetime";

const COL_W = 46; // ancho de cada columna de día (px)
const LABEL_W = 168; // ancho de la columna fija de autos (px)
const ROW_H = 40; // alto de cada fila (px)

/** Etiqueta de estado para el tooltip. "Reservado" se divide en Confirmado
 *  (ya pagó) vs Pendiente (standby / sin pagar) según `confirmed`. */
function statusLabel(bar: CalendarBar): string {
  switch (bar.status) {
    case "cancelled":
      return "Cancelado";
    case "active":
      return "Activo";
    case "finished":
      return "Finalizado";
    default: // reserved
      return bar.confirmed ? "Confirmado" : "Pendiente";
  }
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

type Hover = { bar: CalendarBar; x: number; y: number } | null;

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
  const trackW = columns.length * COL_W;

  const show = (bar: CalendarBar, e: React.MouseEvent) =>
    setHover({ bar, x: e.clientX, y: e.clientY });
  const move = (e: React.MouseEvent) =>
    setHover((h) => (h ? { ...h, x: e.clientX, y: e.clientY } : h));
  const hide = () => setHover(null);

  return (
    <div className="relative rounded-xl border border-foreground/10">
      <div className="overflow-x-auto">
        <div style={{ minWidth: LABEL_W + trackW }}>
          {/* Encabezado de días */}
          <div className="flex border-b border-foreground/10">
            <div
              className="sticky left-0 z-20 shrink-0 border-r border-foreground/10 bg-background px-3 py-2 text-xs font-semibold text-foreground/50"
              style={{ width: LABEL_W }}
            >
              Vehículo
            </div>
            {columns.map((c) => (
              <div
                key={c.key}
                className={`relative shrink-0 py-1 text-center ${
                  c.isWeekend ? "bg-foreground/[0.04]" : ""
                } ${c.isToday ? "bg-blue-500/10" : ""}`}
                style={{ width: COL_W }}
              >
                {c.monthLabel ? (
                  <span className="absolute -top-0 left-1 text-[9px] font-semibold uppercase text-blue-600">
                    {c.monthLabel}
                  </span>
                ) : null}
                <div className={`text-[10px] uppercase ${c.isToday ? "font-bold text-blue-600" : "text-foreground/40"}`}>
                  {c.weekday}
                </div>
                <div className={`text-sm tabular-nums ${c.isToday ? "font-bold text-blue-600" : "text-foreground/70"}`}>
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
              onEnter={show}
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
                  className="sticky left-0 z-10 shrink-0 bg-foreground/[0.03] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground/50"
                  style={{ width: LABEL_W }}
                >
                  Sin unidad asignada
                </div>
                <div style={{ width: trackW }} />
              </div>
              {unassigned.map((row) => (
                <Row
                  key={row.id}
                  row={row}
                  columns={columns}
                  trackW={trackW}
                  onEnter={show}
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
  onEnter,
  onMove,
  onLeave,
}: {
  row: CalendarRow;
  columns: CalendarColumn[];
  trackW: number;
  onEnter: (bar: CalendarBar, e: React.MouseEvent) => void;
  onMove: (e: React.MouseEvent) => void;
  onLeave: () => void;
}) {
  return (
    <div className="flex border-b border-foreground/5 last:border-0">
      {/* Etiqueta del auto (fija a la izquierda). En filas de vehículo la
          patente es lo principal y el modelo el secundario, y linkea al perfil
          del auto. Las filas sin unidad (plate null) no tienen perfil. */}
      {row.plate ? (
        <Link
          href={`/vehicles/${row.id}`}
          className="sticky left-0 z-10 flex shrink-0 flex-col justify-center border-r border-foreground/10 bg-background px-3 transition-colors hover:bg-foreground/5"
          style={{ width: LABEL_W, height: ROW_H }}
        >
          <span className="truncate text-sm font-semibold leading-tight">{row.plate}</span>
          <span className="truncate text-[11px] text-foreground/45">{row.label}</span>
        </Link>
      ) : (
        <div
          className="sticky left-0 z-10 flex shrink-0 flex-col justify-center border-r border-foreground/10 bg-background px-3"
          style={{ width: LABEL_W, height: ROW_H }}
        >
          <span className="truncate text-sm font-medium leading-tight">{row.label}</span>
        </div>
      )}

      {/* Track de días (rosa claro si el auto está fuera de servicio) */}
      <div
        className={`relative ${row.outOfService ? "bg-rose-500/10" : ""}`}
        style={{ width: trackW, height: ROW_H }}
      >
        {/* Líneas de grilla / resaltados por columna */}
        {columns.map((c, i) => (
          <div
            key={c.key}
            className={`absolute top-0 h-full border-r border-foreground/5 ${
              c.isWeekend ? "bg-foreground/[0.03]" : ""
            } ${c.isToday ? "bg-blue-500/[0.07]" : ""}`}
            style={{ left: i * COL_W, width: COL_W }}
          />
        ))}
        {/* Barras de alquiler */}
        {row.bars.map((bar) => (
          <Link
            key={bar.rentalId}
            href={`/rentals/${bar.rentalId}`}
            onMouseEnter={(e) => onEnter(bar, e)}
            onMouseMove={onMove}
            onMouseLeave={onLeave}
            className={`absolute flex items-center overflow-hidden rounded-md px-1.5 text-left text-[11px] font-medium shadow-sm transition-shadow hover:ring-2 ${barClasses(bar)}`}
            style={{
              left: bar.startIndex * COL_W + 2,
              width: bar.span * COL_W - 4,
              top: 6,
              height: ROW_H - 12,
            }}
          >
            <span className="truncate">{bar.clientName}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Tooltip({ hover }: { hover: NonNullable<Hover> }) {
  const { bar, x, y } = hover;
  // Se ubica cerca del cursor, corrido para no taparlo; fixed + pointer-events-none.
  const left = Math.min(x + 14, (typeof window !== "undefined" ? window.innerWidth : 9999) - 300);
  const top = y + 18;
  return (
    <div
      className="pointer-events-none fixed z-50 w-72 rounded-lg border border-foreground/15 bg-background p-3 text-xs shadow-xl"
      style={{ left, top }}
    >
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
    </div>
  );
}
