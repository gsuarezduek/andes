"use client";

import { useEffect, useRef, useState } from "react";
import type {
  CalendarBar,
  CalendarColumn,
  CalendarNote,
  CalendarQuoteBar,
  CalendarRow,
  RoomCalendarBar,
  RoomCalendarRow,
} from "@/lib/calendar";
import { COL_W_MONTH, ROW_H_MONTH, LABEL_W_MOBILE, LABEL_W_CLASS } from "./calendar-constants";
import { ColumnShade, Row, RowShade } from "./calendar-row";
import { RoomRow } from "./room-calendar-row";
import { Tooltip, type Hover } from "./calendar-tooltip";
import type { PaymentPriceAdjustment } from "@/lib/quote-price-options";
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
  thirdPartyRows,
  roomRows,
  unassigned,
  conversationOptions,
  extraHourPercent,
  priceAdjustments,
  userId,
  isAdmin,
}: {
  columns: CalendarColumn[];
  rows: CalendarRow[];
  thirdPartyRows: CalendarRow[];
  roomRows: RoomCalendarRow[];
  unassigned: CalendarRow[];
  conversationOptions: ConversationPickerOption[];
  extraHourPercent: number | null;
  priceAdjustments: PaymentPriceAdjustment[];
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
  // Auto resaltado con un click en su etiqueta: el resto queda con sombra
  // (misma `RowShade` que al presupuestar). Otro click, Escape o un click
  // fuera de las filas lo suelta. Mientras se presupuesta, manda la
  // selección del presupuesto.
  const [focusId, setFocusId] = useState<string | null>(null);
  const shadeOthers = pick != null || focusId != null;
  const dimmedFor = (id: string) => (pick ? pick.vehicleId !== id : focusId != null && focusId !== id);
  const onLabelClick = (id: string) => {
    setHover(null);
    setFocusId((cur) => (cur === id ? null : id));
  };
  // Día resaltado con un click en su encabezado: el resto de las columnas
  // queda con sombra (mismo criterio que el auto resaltado; los dos pueden
  // convivir y se cruzan). Se guarda por fecha (`key`), no por índice, para
  // que el auto-refresco no lo corra de día; si se navega a otra ventana que
  // no incluye ese día, simplemente no se ve. Mientras se presupuesta, manda
  // la selección del presupuesto.
  const [focusDayKey, setFocusDayKey] = useState<string | null>(null);
  const focusDayIndex = focusDayKey ? columns.findIndex((c) => c.key === focusDayKey) : -1;
  const focusedDay = !pick && focusDayIndex >= 0 ? focusDayIndex : null;
  const onDayClick = (key: string) => {
    setHover(null);
    setFocusDayKey((cur) => (cur === key ? null : key));
  };
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const colW = COL_W_MONTH;
  const rowH = ROW_H_MONTH;
  const trackW = columns.length * colW;

  // Con ventanas anchas (90 días) "hoy" puede quedar bien a la derecha del
  // recorte inicial de la pantalla — sin esto, entrar a la vista arranca
  // mostrando el pasado lejano en vez de arrancar cerca de hoy. Deja un par
  // de columnas de contexto antes en vez de pegar "hoy" al borde izquierdo.
  // Si la ventana no incluye hoy (se navegó lejos con Anterior/Siguiente),
  // arranca al principio en vez de heredar el scroll de la navegación previa.
  // Sólo corre cuando cambia la ventana (nueva navegación desde el server) —
  // comparado por rango de fechas, no por identidad del array: el
  // AutoRefresh de abajo pide la misma ventana cada 30s y el server devuelve
  // un `columns` nuevo igual aunque el usuario no haya navegado, lo que sin
  // esta guarda reseteaba el scroll manual de vuelta a "hoy" solo.
  const rangeKey = columns.length ? `${columns[0]!.key}:${columns[columns.length - 1]!.key}` : "";
  const lastRangeKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!bodyScrollRef.current) return;
    if (lastRangeKeyRef.current === rangeKey) return;
    lastRangeKeyRef.current = rangeKey;
    const todayIndex = columns.findIndex((c) => c.isToday);
    const left = todayIndex >= 0 ? Math.max(0, (todayIndex - 3) * colW) : 0;
    bodyScrollRef.current.scrollLeft = left;
    if (headerScrollRef.current) headerScrollRef.current.scrollLeft = left;
  }, [rangeKey, columns, colW]);

  const show = (bar: CalendarBar, e: React.MouseEvent) =>
    setHover({ type: "bar", bar, x: e.clientX, y: e.clientY });
  const showNotes = (title: string, notes: CalendarNote[], e: React.MouseEvent) =>
    setHover({ type: "notes", title, notes, x: e.clientX, y: e.clientY });
  const showSeason = (seasons: CalendarColumn["seasons"], e: React.MouseEvent) =>
    setHover({ type: "season", seasons, x: e.clientX, y: e.clientY });
  const showQuote = (quote: CalendarQuoteBar, e: React.MouseEvent) =>
    setHover({ type: "quote", quote, x: e.clientX, y: e.clientY });
  const showRoom = (room: RoomCalendarBar, e: React.MouseEvent) => {
    const r = roomRows.find((x) => x.id === room.roomId);
    setHover({
      type: "room",
      room,
      checkIn: r?.checkInTime ?? "",
      checkOut: r?.checkOutTime ?? "",
      x: e.clientX,
      y: e.clientY,
    });
  };
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
          : hover?.type === "room"
            ? `room:${hover.room.bookingId}`
            : null;

  // Selección de auto+rango para un presupuesto nuevo (dos toques): sin
  // selección activa, el primer toque la arranca; un segundo toque en la
  // misma fila la completa — en la misma celda, es un presupuesto de 1 solo
  // día (antes cancelaba: no había forma de presupuestar un día suelto si el
  // siguiente estaba ocupado, porque el toque cae sobre la barra de esa
  // reserva). Un toque en otra fila la reinicia ahí; para cancelar, tocar
  // afuera de la grilla o Escape.
  function onCellClick(vehicleId: string, dayIndex: number) {
    setHover(null);
    if (!pick || pick.vehicleId !== vehicleId) {
      setPick({ vehicleId, startIndex: dayIndex });
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

  const draftRow = draftRange
    ? rows.find((r) => r.id === draftRange.vehicleId) ?? thirdPartyRows.find((r) => r.id === draftRange.vehicleId)
    : null;
  const canEditQuoteDetail = quoteDetail ? isAdmin || quoteDetail.createdById === userId : false;

  // El header (fechas) y el cuerpo (filas) son dos contenedores con scroll
  // horizontal propio, sincronizados a mano: un único contenedor con
  // scroll en ambos ejes rompería el `sticky top` del header contra la
  // página (overflow-x distinto de "visible" fuerza overflow-y a "auto",
  // y el header terminaría pegado a ESE contenedor en vez de a la ventana).
  // Separándolos, el header queda realmente sticky contra el scroll de la
  // página y la tabla puede crecer tan alta como haga falta sin cortar filas.
  useEffect(() => {
    if (!pick && !focusId && !focusDayKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Primero cancela el presupuesto en curso; un segundo Escape suelta el
      // auto y el día resaltados.
      if (pick) setPick(null);
      else {
        setFocusId(null);
        setFocusDayKey(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pick, focusId, focusDayKey]);

  const syncHeaderScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (headerScrollRef.current) headerScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
  };

  return (
    <div
      className="relative rounded-xl border border-foreground/10"
      onClick={() => {
        hide();
        setPick(null);
        setFocusId(null);
        setFocusDayKey(null);
      }}
    >
      {pick ? (
        <div className="pointer-events-none fixed inset-x-0 top-2 z-50 flex justify-center">
          <p className="rounded-full bg-orange-600 px-4 py-1.5 text-xs font-medium text-white shadow-lg">
            Presupuestando: tocá el día de fin (el mismo día = 1 día) · tocá afuera para cancelar
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
          <div className="relative flex" style={{ width: trackW }}>
          <ColumnShade index={focusedDay} colW={colW} trackW={trackW} zClass="z-10" />
          {columns.map((c, i) => {
            const hasSeason = c.seasons.length > 0;
            const dayFocused = focusedDay === i;
            return (
              <div
                key={c.key}
                role="button"
                tabIndex={0}
                aria-pressed={dayFocused}
                title={
                  (c.special ? `${c.special.label} · ` : "") +
                  (dayFocused ? "Mostrar todos los días" : "Resaltar solo este día")
                }
                onClick={(e) => {
                  e.stopPropagation();
                  onDayClick(c.key);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onDayClick(c.key);
                  }
                }}
                className={`relative shrink-0 cursor-pointer py-1 text-center transition-colors hover:bg-foreground/[0.06] ${
                  c.isToday ? "bg-blue-500/25" : c.special ? "bg-yellow-400/25" : c.isWeekend ? "bg-foreground/[0.04]" : ""
                } ${dayFocused ? "ring-2 ring-inset ring-blue-500" : ""}`}
                style={{ width: colW }}
              >
                {c.monthLabel ? (
                  <span className="absolute -top-0 left-1 text-[9px] font-semibold uppercase text-blue-600">
                    {c.monthLabel}
                  </span>
                ) : null}
                <div className={`uppercase text-[10px] ${c.isToday ? "font-bold text-blue-600" : "text-foreground/40"}`}>
                  {c.weekday}
                </div>
                <div className={`tabular-nums text-sm ${c.isToday ? "font-bold text-blue-600" : "text-foreground/70"}`}>
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
              activeKey={activeKey}
              onEnter={show}
              onEnterNote={showNotes}
              onMove={move}
              onLeave={hide}
              quotePick={pick?.vehicleId === row.id ? pick.startIndex : null}
              dimmed={dimmedFor(row.id)}
              focused={focusId === row.id}
              focusedDay={focusedDay}
              onLabelClick={onLabelClick}
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

          {/* Vehículos de terceros */}
          {thirdPartyRows.length > 0 ? (
            <>
              <div className="relative flex border-t border-foreground/10 bg-foreground/[0.03]">
                <RowShade active={shadeOthers} />
                <div
                  className={`sticky left-0 z-10 shrink-0 truncate bg-foreground/[0.03] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground/50 ${LABEL_W_CLASS}`}
                >
                  Terceros
                </div>
                <div className="relative" style={{ width: trackW }}>
                  <ColumnShade index={focusedDay} colW={colW} trackW={trackW} />
                </div>
              </div>
              {thirdPartyRows.map((row) => (
                <Row
                  key={row.id}
                  row={row}
                  columns={columns}
                  trackW={trackW}
                  colW={colW}
                  rowH={rowH}
                  activeKey={activeKey}
                  onEnter={show}
                  onEnterNote={showNotes}
                  onMove={move}
                  onLeave={hide}
                  quotePick={pick?.vehicleId === row.id ? pick.startIndex : null}
                  dimmed={dimmedFor(row.id)}
              focused={focusId === row.id}
              focusedDay={focusedDay}
              onLabelClick={onLabelClick}
                  onCellClick={onCellClick}
                  onQuoteEnter={showQuote}
                  onQuoteClick={setQuoteDetail}
                />
              ))}
            </>
          ) : null}

          {/* Habitaciones (alquiler temporario) */}
          {roomRows.length > 0 ? (
            <>
              <div className="relative flex border-t border-foreground/10 bg-foreground/[0.03]">
                <RowShade active={shadeOthers} />
                <div
                  className={`sticky left-0 z-10 shrink-0 truncate bg-foreground/[0.03] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground/50 ${LABEL_W_CLASS}`}
                >
                  Habitaciones
                </div>
                <div className="relative" style={{ width: trackW }}>
                  <ColumnShade index={focusedDay} colW={colW} trackW={trackW} />
                </div>
              </div>
              {roomRows.map((room) => (
                <RoomRow
                  key={room.id}
                  row={room}
                  columns={columns}
                  trackW={trackW}
                  colW={colW}
                  rowH={rowH}
                  activeKey={activeKey}
                  onEnter={showRoom}
                  onMove={move}
                  onLeave={hide}
                  dimmed={shadeOthers}
                  focusedDay={focusedDay}
                />
              ))}
            </>
          ) : null}

          {/* Reservas sin unidad asignada */}
          {unassigned.length > 0 ? (
            <>
              <div className="relative flex border-t border-foreground/10 bg-foreground/[0.03]">
                <RowShade active={shadeOthers} />
                <div
                  className={`sticky left-0 z-10 shrink-0 truncate bg-foreground/[0.03] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground/50 ${LABEL_W_CLASS}`}
                >
                  <span className="sm:hidden">Sin unidad</span>
                  <span className="hidden sm:inline">Sin unidad asignada</span>
                </div>
                <div className="relative" style={{ width: trackW }}>
                  <ColumnShade index={focusedDay} colW={colW} trackW={trackW} />
                </div>
              </div>
              {unassigned.map((row) => (
                <Row
                  key={row.id}
                  row={row}
                  columns={columns}
                  trackW={trackW}
                  colW={colW}
                  rowH={rowH}
                  activeKey={activeKey}
                  onEnter={show}
                  onEnterNote={showNotes}
                  onMove={move}
                  onLeave={hide}
                  quotePick={null}
                  dimmed={shadeOthers}
                  focusedDay={focusedDay}
                  onLabelClick={onLabelClick}
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
          extraHourPercent={extraHourPercent}
          priceAdjustments={priceAdjustments}
          onClose={() => setDraftRange(null)}
        />
      ) : null}

      {quoteDetail ? (
        <QuoteDetailModal
          quote={quoteDetail}
          canEdit={canEditQuoteDetail}
          conversationOptions={conversationOptions}
          priceAdjustments={priceAdjustments}
          onClose={() => setQuoteDetail(null)}
        />
      ) : null}
    </div>
  );
}
