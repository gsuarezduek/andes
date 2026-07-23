"use client";

import { useState } from "react";
import type { CalendarBar, CalendarColumn, CalendarNote, CalendarRow } from "@/lib/calendar";
import {
  COL_W_MONTH,
  COL_W_WEEK,
  ROW_H_MONTH,
  ROW_H_WEEK,
  WEEK_MAX_COLUMNS,
  LABEL_W_MOBILE,
  LABEL_W_CLASS,
} from "./calendar-constants";
import { Row } from "./calendar-row";
import { Tooltip, type Hover } from "./calendar-tooltip";

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
