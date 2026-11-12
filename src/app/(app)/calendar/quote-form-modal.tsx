"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { TextField, TextareaField } from "@/components/ui/fields";
import { ConversationPicker } from "@/components/whatsapp/conversation-picker";
import type { ConversationPickerOption } from "@/lib/rental-quotes";
import type { CalendarColumn, CalendarRow } from "@/lib/calendar";
import { buildQuoteRange, estimateQuoteTotal, quoteDaysBreakdown, quotePricePerDay } from "@/lib/quote-estimate";
import { formatArs } from "@/lib/contract";
import { createQuote } from "./actions";
import { sendQuoteWhatsApp, type SendQuoteWhatsAppResult } from "./quote-whatsapp-actions";
import type { PaymentPriceAdjustment } from "@/lib/quote-price-options";
import { QuotePriceBox } from "./quote-per-day-box";

/** Horario por defecto al abrir el presupuestador: retiro y devolución a la
 *  misma hora al día siguiente ya facturan 1 día, no 2 — el caso más común.
 *  Editable; se puede borrar para volver al criterio de "días de calendario". */
const DEFAULT_TIME = "09:00";
/** Devolución por defecto de un presupuesto de 1 solo día (mismo día de
 *  calendario elegido dos veces): vuelve ese mismo día a la tarde — si fuera
 *  a la mañana siguiente pisaría el día de al lado, que en el caso típico
 *  (día suelto entre dos reservas) está ocupado. Editable. */
const SINGLE_DAY_RETURN_TIME = "20:00";

/** "2026-07-18" → "18/07". */
function fmtShortDate(s: string): string {
  const [, m, d] = s.split("-");
  return `${d}/${m}`;
}

/** Alta de un presupuesto — se abre al completar la selección de días (dos
 *  toques) en una fila del Calendario. Todo el resumen/sugerido se calcula
 *  100% en el cliente, a partir de los datos que ya trajo `getCalendarData`
 *  (sin queries nuevas). */
export function QuoteFormModal({
  vehicleId,
  startIndex,
  endIndex,
  row,
  columns,
  conversationOptions,
  extraHourPercent,
  priceAdjustments,
  onClose,
}: {
  vehicleId: string;
  startIndex: number;
  endIndex: number;
  row: CalendarRow;
  columns: CalendarColumn[];
  conversationOptions: ConversationPickerOption[];
  extraHourPercent: number | null;
  /** Descuentos/recargos por medio de pago de VikRentCar (ver `quotePriceOptions`). */
  priceAdjustments: PaymentPriceAdjustment[];
  onClose: () => void;
}) {
  const days = endIndex - startIndex + 1;
  const singleDay = days === 1;
  const startKey = columns[startIndex]!.key;
  const endKey = columns[endIndex]!.key;
  const rangeDays = columns.slice(startIndex, endIndex + 1);
  // Temporadas de ESTE auto puntual (row.seasonsByDay, filtrado por
  // wpCarId) — no `CalendarColumn.seasons`, que es fleet-wide y solo
  // alimenta el marcador visual del encabezado.
  const daySeasons = row.seasonsByDay.slice(startIndex, endIndex + 1);

  // Horarios de retiro/devolución: siempre visibles, precargados a la misma
  // hora (retiro hoy 9am + devolución mañana 9am ya factura 1 día, no 2) —
  // editable, y se puede vaciar para volver al criterio de "días de
  // calendario" (ver `buildQuoteRange`).
  const [pickupTime, setPickupTime] = useState(DEFAULT_TIME);
  const [returnTime, setReturnTime] = useState(singleDay ? SINGLE_DAY_RETURN_TIME : DEFAULT_TIME);
  const { startAt, endAt } = buildQuoteRange(startKey, endKey, pickupTime || null, returnTime || null);
  const timesInvalid = endAt.getTime() <= startAt.getTime();
  const breakdown = timesInvalid ? { days, extraHours: 0 } : quoteDaysBreakdown(startAt, endAt);

  const suggested = estimateQuoteTotal(row.dailyRate, row.todaySeasons, daySeasons, breakdown, extraHourPercent);
  const seasonDaysInRange = rangeDays
    .map((c, i) => ({ key: c.key, seasons: daySeasons[i]! }))
    .filter((d) => d.seasons.length > 0);

  const conflicts = [
    ...row.bars
      .filter((b) => b.startIndex <= endIndex && b.startIndex + b.span - 1 >= startIndex)
      .map((b) => b.clientName),
    ...row.quotes
      .filter((q) => q.startIndex <= endIndex && q.startIndex + q.span - 1 >= startIndex)
      .map((q) => `Presupuesto: ${q.clientName ?? "sin nombre"}`),
  ];

  // El total sigue al sugerido mientras el usuario no lo haya editado a
  // mano — derivado directo, sin estado espejo: fix del bug donde quedaba
  // pegado al sugerido inicial y, al cambiar los horarios, el "precio por
  // día" se recalculaba sobre ese total viejo (subía en vez de quedar igual).
  const [totalOverride, setTotalOverride] = useState<string | null>(null);
  const total = totalOverride ?? (suggested != null ? String(suggested.total) : "");
  const totalNumber = Number(total.replace(",", "."));
  const perDay = quotePricePerDay(totalNumber, breakdown.days);
  const hasPriceAdjustments = priceAdjustments.length > 0;
  const [conversation, setConversation] = useState<ConversationPickerOption | null>(null);
  const [pending, start] = useTransition();
  const [retrying, startRetry] = useTransition();
  const [error, setError] = useState<string>();
  // Presupuesto ya guardado pero cuyo envío por WhatsApp no salió: el modal
  // queda abierto mostrando el motivo (en vez de cerrarse como si nada) y el
  // formulario se bloquea para no guardarlo dos veces.
  const [savedUnsent, setSavedUnsent] = useState<{ id: string; result: SendQuoteWhatsAppResult } | null>(null);
  // "Guardar y enviar" no es un submit propio a propósito: Enter en un campo
  // de texto dispara el primer botón submit del form, y no queremos mandarle
  // un WhatsApp al cliente por apretar Enter. Este botón marca la intención y
  // pide el submit a mano.
  const sendIntent = useRef(false);
  const router = useRouter();

  function closeAndRefresh() {
    onClose();
    router.refresh();
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (savedUnsent) return;
    setError(undefined);
    const send = sendIntent.current && conversation != null;
    sendIntent.current = false;
    const data = new FormData(e.currentTarget);
    data.set("vehicleId", vehicleId);
    data.set("startDate", startKey);
    data.set("endDate", endKey);
    if (conversation) data.set("conversationId", conversation.id);
    start(async () => {
      try {
        const { id, whatsapp } = await createQuote(data, send);
        if (whatsapp && !whatsapp.sent) {
          setSavedUnsent({ id, result: whatsapp });
          return;
        }
        closeAndRefresh();
      } catch {
        setError("No se pudo guardar el presupuesto.");
      }
    });
  }

  function retrySend() {
    if (!savedUnsent) return;
    const { id } = savedUnsent;
    startRetry(async () => {
      const result = await sendQuoteWhatsApp(id);
      if (result.sent) closeAndRefresh();
      else setSavedUnsent({ id, result });
    });
  }

  return (
    <Modal open onClose={onClose} title="Nuevo presupuesto" className="max-w-md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <fieldset disabled={savedUnsent != null} className="contents">
        <div className="rounded-lg border border-foreground/10 bg-foreground/[0.03] p-3 text-sm">
          <p className="font-semibold">{row.name ?? row.plate ?? row.label}</p>
          <p className="text-foreground/60">
            {singleDay
              ? `${fmtShortDate(startKey)} · 1 día`
              : `${fmtShortDate(startKey)} al ${fmtShortDate(endKey)} · ${days} días`}
          </p>
        </div>

        <div className="rounded-lg border border-foreground/10 p-3 text-sm">
          <p className="mb-2 font-medium text-foreground/70">Horarios de retiro/devolución</p>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              id="pickupTime"
              label="Hora de retiro"
              type="time"
              value={pickupTime}
              onChange={(e) => setPickupTime(e.target.value)}
            />
            <TextField
              id="returnTime"
              label="Hora de devolución"
              type="time"
              value={returnTime}
              onChange={(e) => setReturnTime(e.target.value)}
            />
          </div>
          {timesInvalid ? (
            <p className="mt-2 text-xs font-medium text-red-600">
              La devolución tiene que ser posterior al retiro.
            </p>
          ) : (
            <p className="mt-2 text-xs text-foreground/60">
              Se factura <span className="font-semibold">{breakdown.days}</span> día
              {breakdown.days === 1 ? "" : "s"}
              {breakdown.extraHours > 0
                ? ` + ${breakdown.extraHours} hora${breakdown.extraHours === 1 ? "" : "s"} extra`
                : ""}
              {breakdown.days + (breakdown.extraHours > 0 ? 1 : 0) !== days
                ? ` (ocupa ${days} día${days === 1 ? "" : "s"} del calendario)`
                : ""}
              .
            </p>
          )}
        </div>

        {/* Ya guardado: el calendario se refresca con este mismo presupuesto
            adentro y el aviso lo contaría como una superposición consigo mismo. */}
        {conflicts.length > 0 && !savedUnsent ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-amber-700 dark:text-amber-400">
            Ojo: se superpone con {conflicts.join(", ")}. Es solo un borrador — se puede guardar igual.
          </p>
        ) : null}

        {seasonDaysInRange.length > 0 ? (
          <p className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-2.5 text-xs text-purple-700 dark:text-purple-400">
            Incluye temporada con aumento (
            {seasonDaysInRange.map((c) => `${fmtShortDate(c.key)} +${c.seasons[0]!.diffPercent}%`).join(", ")}) —
            el sugerido ya lo tiene en cuenta.
          </p>
        ) : null}

        <TextField
          id="estimatedTotal"
          label={hasPriceAdjustments ? "Total estimado (precio de lista)" : "Total estimado"}
          hint={
            suggested != null
              ? `Sugerido: ${formatArs(suggested.total)} (tarifa × días${seasonDaysInRange.length > 0 ? ", con temporada" : ""})`
              : "Sin tarifa cargada para este auto"
          }
          type="text"
          inputMode="decimal"
          prefix="$"
          value={total}
          onChange={(e) => setTotalOverride(e.target.value)}
        />
        {perDay != null ? (
          <QuotePriceBox
            total={totalNumber}
            days={breakdown.days}
            adjustments={priceAdjustments}
            extra={suggested && suggested.extraAmount > 0 ? { hours: breakdown.extraHours, amount: suggested.extraAmount } : null}
          />
        ) : null}
        <TextField id="clientName" label="Cliente" hint="Opcional" type="text" />
        <TextareaField id="note" label="Nota" hint="Opcional" />

        <div>
          <p className="mb-1.5 text-sm font-medium text-foreground/80">Conversación de WhatsApp</p>
          <ConversationPicker options={conversationOptions} selected={conversation} onPick={setConversation} />
          {!conversation ? (
            <p className="mt-1.5 text-xs text-foreground/50">
              Vinculá la conversación del cliente para poder enviarle el presupuesto al guardar.
            </p>
          ) : null}
        </div>
        </fieldset>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {savedUnsent ? (
          // En el celular el resultado queda abajo del formulario: se baja
          // solo hasta acá para que no pase desapercibido.
          <div ref={(el) => el?.scrollIntoView({ block: "nearest", behavior: "smooth" })} className="flex flex-col gap-2">
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2 text-sm text-emerald-700 dark:text-emerald-400">
              Presupuesto guardado.
            </p>
            <p
              className={
                savedUnsent.result.kind === "failed"
                  ? "text-sm text-red-600"
                  : "rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-sm text-amber-700 dark:text-amber-400"
              }
            >
              {savedUnsent.result.error ?? "No se pudo enviar por WhatsApp."}
            </p>
            <div className="flex gap-2">
              {savedUnsent.result.kind === "failed" ? (
                <Button type="button" variant="secondary" className="flex-1" onClick={retrySend} disabled={pending || retrying}>
                  {retrying ? "Enviando…" : "Reintentar envío"}
                </Button>
              ) : null}
              <Button type="button" className="flex-1" onClick={closeAndRefresh} disabled={retrying}>
                Cerrar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {conversation ? (
              <Button
                type="button"
                disabled={pending || timesInvalid}
                onClick={(e) => {
                  sendIntent.current = true;
                  e.currentTarget.form?.requestSubmit();
                }}
              >
                {pending ? "Guardando…" : "Guardar y enviar por WhatsApp"}
              </Button>
            ) : null}
            <div className="flex gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={pending}>
                Cancelar
              </Button>
              <Button
                type="submit"
                variant={conversation ? "secondary" : undefined}
                className="flex-1"
                disabled={pending || timesInvalid}
              >
                {pending ? "Guardando…" : conversation ? "Guardar sin enviar" : "Guardar presupuesto"}
              </Button>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
