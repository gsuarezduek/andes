"use client";

import { useEffect, useRef, useState } from "react";
import type { CalendarBar, CalendarColumn, CalendarNote, CalendarQuoteBar, CalendarRow } from "@/lib/calendar";
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
import { QuoteFormModal } from "./quote-form-modal";
import { QuoteDetailModal } from "./quote-detail-modal";
import type { ConversationPickerOption } from "@/lib/rental-quotes";
import { AutoRefresh } from "@/components/auto-refresh";

// Altura del header fijo de la app (logo + nav, ver `(app)/layout.tsx`) — el
// header de fechas del calendario se pega debajo de él, no del todo arriba.
const APP_HEADER_H = 65;

export function CalendarGrid({
  columns,
  rows,
  unassigned,
  conversationOptions,
  userId,
  isAdmin,
}: {
  columns: CalendarColumn[];
  rows: CalendarRow[];
  unassigned: CalendarRow[];
  conversationOptions: ConversationPickerOption[];
  userId: string;
  isAdmin: boolean;
}) {
  const [hover, setHover] = useState<Hover>(null);
  // Selección de un presupuesto en curso: día de inicio elegido, esperando
  // el segundo toque (día de fin) en la misma fila.
  const [pick, setPick] = useState<{ vehicleId: string; startIndex: number } | null>(null);
  const [draftRange, setDraftRange] = useState<{ vehicleId: string; startIndex: number; endIndex: number } | null>(
    null,
  );
  const [quoteDetail, setQuoteDetail] = useState<CalendarQuoteBar | null>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const dense = columns.length <= WEEK_MAX_COLUMNS;
  const colW = dense ? COL_W_WEEK : COL_W_MONTH;
  const rowH = dense ? ROW_H_WEEK : ROW_H_MONTH;
  const trackW = columns.length * colW;

  // Con ventanas anchas (90 días) "hoy" puede quedar bien a la derecha del
  // recorte inicial de la pantalla — sin esto, entrar a la vista arranca
  // mostrando el pasado lejano en vez de arrancar cerca de hoy. Deja un par
  // de columnas de contexto antes en vez de pegar "hoy" al borde izquierdo.
  // Si la ventana no incluye hoy (se navegó lejos con Anterior/Siguiente),
  // arranca al principio en vez de heredar el scroll de la navegación previa.
  // Sólo corre cuando cambia la ventana (nueva navegación desde el server),
  // no hay scroll automático mientras el usuario navega la grilla a mano.
  useEffect(() => {
    if (!bodyScrollRef.current) return;
    const todayIndex = columns.findIndex((c) => c.isToday);
    const left = todayIndex >= 0 ? Math.max(0, (todayIndex - 3) * colW) : 0;
    bodyScrollRef.current.scrollLeft = left;
    if (headerScrollRef.current) headerScrollRef.current.scrollLeft = left;
  }, [columns, colW]);

  const show = (bar: CalendarBar, e: React.MouseEvent) =>
    setHover({ type: "bar", bar, x: e.clientX, y: e.clientY });
  const showNotes = (title: string, notes: CalendarNote[], e: React.MouseEvent) =>
    setHover({ type: "notes", title, notes, x: e.clientX, y: e.clientY });
  const showSeason = (seasons: CalendarColumn["seasons"], e: React.MouseEvent) =>
    setHover({ type: "season", seasons, x: e.clientX, y: e.clientY });
  const showQuote = (quote: CalendarQuoteBar, e: React.MouseEvent) =>
    setHover({ type: "quote", quote, x: e.clientX, y: e.clientY });
  const move = (e: React.MouseEvent) =>
    setHover((h) => (h ? { ...h, x: e.clientX, y: e.clientY } : h));
  const hide = () => setHover(null);
  // En touch no hay hover: la barra se identifica primero (muestra el tooltip)
  // y recién un segundo toque sobre la misma barra navega. Ver activeKey en Row.
  const activeKey =
    hover?.type === "bar"
      ? `bar:${hover.bar.rentalId}`
      : hover?.type === "notes"
        ? `notes:${hover.title}`
        : hover?.type === "quote"
          ? `quote:${hover.quote.quoteId}`
          : null;

  // Selección de auto+rango para un presupuesto nuevo (dos toques): sin
  // selección activa, el primer toque la arranca; un segundo toque en la
  // misma fila la completa (o la cancela, si es la misma celda); un toque en
  // otra fila la reinicia ahí.
  function onCellClick(vehicleId: string, dayIndex: number) {
    setHover(null);
    if (!pick || pick.vehicleId !== vehicleId) {
      setPick({ vehicleId, startIndex: dayIndex });
      return;
    }
    if (pick.startIndex === dayIndex) {
      setPick(null);
      return;
    }
    setDraftRange({
      vehicleId,
      startIndex: Math.min(pick.startIndex, dayIndex),
      endIndex: Math.max(pick.startIndex, dayIndex),
    });
    setPick(null);
  }
  const noCellClick = () => {};

  const draftRow = draftRange ? rows.find((r) => r.id === draftRange.vehicleId) : null;
  const canEditQuoteDetail = quoteDetail ? isAdmin || quoteDetail.createdById === userId : false;

  // El header (fechas) y el cuerpo (filas) son dos contenedores con scroll
  // horizontal propio, sincronizados a mano: un único contenedor con
  // scroll en ambos ejes rompería el `sticky top` del header contra la
  // página (overflow-x distinto de "visible" fuerza overflow-y a "auto",
  // y el header terminaría pegado a ESE contenedor en vez de a la ventana).
  // Separándolos, el header queda realmente sticky contra el scroll de la
  // página y la tabla puede crecer tan alta como haga falta sin cortar filas.
  const syncHeaderScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (headerScrollRef.current) headerScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
  };

  return (
    <div
      className="relative rounded-xl border border-foreground/10"
      onClick={() => {
        hide();
        setPick(null);
      }}
    >
      {pick ? (
        <div className="pointer-events-none fixed inset-x-0 top-2 z-50 flex justify-center">
          <p className="rounded-full bg-orange-600 px-4 py-1.5 text-xs font-medium text-white shadow-lg">
            Presupuestando: tocá el día de fin (o el mismo día para cancelar)
          </p>
        </div>
      ) : null}
      {/* Encabezado de días: sticky contra la página (debajo del header fijo
          de la app), con scroll horizontal propio pero sin barra visible —
          se mueve solo cuando se sincroniza con el scroll del cuerpo. */}
      <div
        ref={headerScrollRef}
        className="sticky z-30 overflow-x-hidden rounded-t-xl border-b border-foreground/10 bg-background"
        style={{ top: APP_HEADER_H }}
      >
        <div className="flex" style={{ minWidth: LABEL_W_MOBILE + trackW }}>
          <div
            className={`sticky left-0 z-20 shrink-0 truncate border-r border-foreground/10 bg-background px-3 py-2 text-xs font-semibold text-foreground/50 ${LABEL_W_CLASS}`}
          >
            <span className="sm:hidden">Vehículo</span>
            <span className="hidden sm:inline">Vehículo/Precio</span>
          </div>
          {columns.map((c) => {
            const hasSeason = c.seasons.length > 0;
            return (
              <div
                key={c.key}
                className={`relative shrink-0 py-1 text-center ${
                  c.isToday ? "bg-blue-500/25" : c.isWeekend ? "bg-foreground/[0.04]" : ""
                }`}
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
                {hasSeason ? (
                  <span
                    onMouseEnter={(e) => {
                      e.stopPropagation();
                      showSeason(c.seasons, e);
                    }}
                    onMouseMove={(e) => {
                      e.stopPropagation();
                      move(e);
                    }}
                    onMouseLeave={hide}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      showSeason(c.seasons, e);
                    }}
                    className="absolute inset-x-1 bottom-0.5 h-1 cursor-help rounded-full bg-purple-500"
                    title={`Temporada con aumento: +${c.seasons[0]!.diffPercent}%`}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Cuerpo: scroll horizontal propio (con barra visible), alto libre —
          crece con la cantidad de autos, sin recortar filas. */}
      <div ref={bodyScrollRef} className="overflow-x-auto rounded-b-xl" onScroll={syncHeaderScroll}>
        <div style={{ minWidth: LABEL_W_MOBILE + trackW }}>
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
              activeKey={activeKey}
              onEnter={show}
              onEnterNote={showNotes}
              onMove={move}
              onLeave={hide}
              quotePick={pick?.vehicleId === row.id ? pick.startIndex : null}
              onCellClick={onCellClick}
              onQuoteEnter={showQuote}
              onQuoteClick={setQuoteDetail}
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
                  activeKey={activeKey}
                  onEnter={show}
                  onEnterNote={showNotes}
                  onMove={move}
                  onLeave={hide}
                  quotePick={null}
                  onCellClick={noCellClick}
                  onQuoteEnter={showQuote}
                  onQuoteClick={setQuoteDetail}
                />
              ))}
            </>
          ) : null}
        </div>
      </div>

      {hover ? <Tooltip hover={hover} /> : null}

      {/* Pausado mientras hay un presupuesto en selección/edición — un
          refresco a mitad de camino podía tirar abajo el modal abierto
          (perdiendo lo tipeado) antes de que el empleado llegara a guardar. */}
      {!pick && !draftRange && !quoteDetail ? <AutoRefresh intervalMs={30_000} /> : null}

      {draftRange && draftRow ? (
        <QuoteFormModal
          vehicleId={draftRange.vehicleId}
          startIndex={draftRange.startIndex}
          endIndex={draftRange.endIndex}
          row={draftRow}
          columns={columns}
          conversationOptions={conversationOptions}
          onClose={() => setDraftRange(null)}
        />
      ) : null}

      {quoteDetail ? (
        <QuoteDetailModal
          quote={quoteDetail}
          canEdit={canEditQuoteDetail}
          conversationOptions={conversationOptions}
          onClose={() => setQuoteDetail(null)}
        />
      ) : null}
    </div>
  );
}
