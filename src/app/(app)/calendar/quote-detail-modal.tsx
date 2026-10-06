"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { TextField, TextareaField } from "@/components/ui/fields";
import { ConversationPicker } from "@/components/whatsapp/conversation-picker";
import type { ConversationPickerOption } from "@/lib/rental-quotes";
import type { CalendarQuoteBar } from "@/lib/calendar";
import { formatArs } from "@/lib/contract";
import { buildQuoteRange, quoteBillableDays, quotePricePerDay, splitQuoteRange } from "@/lib/quote-estimate";
import { updateQuote, deleteQuote } from "./actions";
import { PerDayBox } from "./quote-per-day-box";

/** Detalle de un presupuesto ya cargado — se abre al tocar su barra. Solo
 *  quien lo creó (o un admin) puede editarlo/borrarlo (mismo criterio que
 *  `assertCanEditTask`); el resto ve una vista de solo lectura. */
export function QuoteDetailModal({
  quote,
  canEdit,
  conversationOptions,
  onClose,
}: {
  quote: CalendarQuoteBar;
  canEdit: boolean;
  conversationOptions: ConversationPickerOption[];
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const router = useRouter();

  const saved = splitQuoteRange(quote.startAt, quote.endAt);
  const initialConversation: ConversationPickerOption | null = quote.conversationId
    ? {
        id: quote.conversationId,
        phoneE164: quote.conversationLabel ?? "",
        customerName: null,
        label: quote.conversationLabel ?? "Conversación vinculada",
      }
    : null;
  const [conversation, setConversation] = useState<ConversationPickerOption | null>(initialConversation);
  const [startValue, setStartValue] = useState(saved.startDayKey);
  const [endValue, setEndValue] = useState(saved.endDayKey);
  const [pickupTime, setPickupTime] = useState(saved.pickupTime);
  const [returnTime, setReturnTime] = useState(saved.returnTime);
  const [totalValue, setTotalValue] = useState(quote.estimatedTotal != null ? String(quote.estimatedTotal) : "");

  const { startAt: liveStartAt, endAt: liveEndAt } =
    startValue && endValue
      ? buildQuoteRange(startValue, endValue, pickupTime || null, returnTime || null)
      : { startAt: quote.startAt, endAt: quote.endAt };
  const timesInvalid = liveEndAt.getTime() <= liveStartAt.getTime();
  const liveDays = timesInvalid ? 0 : quoteBillableDays(liveStartAt, liveEndAt);
  const perDay = quotePricePerDay(Number(totalValue.replace(",", ".")), liveDays);
  const savedDays = quoteBillableDays(quote.startAt, quote.endAt);
  const savedPerDay = quotePricePerDay(quote.estimatedTotal, savedDays);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    const data = new FormData(e.currentTarget);
    data.set("vehicleId", quote.vehicleId);
    if (conversation) data.set("conversationId", conversation.id);
    startTransition(async () => {
      try {
        await updateQuote(quote.quoteId, data);
        onClose();
        router.refresh();
      } catch {
        setError("No se pudo guardar el cambio.");
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteQuote(quote.quoteId);
        onClose();
        router.refresh();
      } catch {
        setError("No se pudo eliminar el presupuesto.");
      }
    });
  }

  if (!canEdit) {
    return (
      <Modal open onClose={onClose} title="Presupuesto" className="max-w-sm">
        <div className="flex flex-col gap-2 text-sm">
          <p className="font-semibold">{quote.clientName ?? "Sin nombre de cliente"}</p>
          {quote.estimatedTotal != null ? <p>Total estimado: {formatArs(quote.estimatedTotal)}</p> : null}
          {savedPerDay != null ? <PerDayBox perDay={savedPerDay} days={savedDays} /> : null}
          {saved.pickupTime || saved.returnTime ? (
            <p className="text-foreground/60">
              Retiro {saved.pickupTime || "—"} · Devolución {saved.returnTime || "—"}
            </p>
          ) : null}
          <p className="text-foreground/60">
            {quote.createdByName ? `Cargado por ${quote.createdByName}` : "Cargado por un compañero"}
          </p>
          {quote.conversationId ? (
            <Link href={`/whatsapp/${quote.conversationId}`} className="text-indigo-600 hover:underline dark:text-indigo-400">
              🔗 Ver conversación de WhatsApp
            </Link>
          ) : null}
          {quote.note ? <p className="whitespace-pre-wrap border-t border-foreground/10 pt-2 text-foreground/80">{quote.note}</p> : null}
          <Button type="button" variant="secondary" className="mt-2" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="Presupuesto" className="max-w-md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <fieldset disabled={!editing} className="contents">
          <div className="grid grid-cols-2 gap-3">
            <TextField id="startDate" label="Desde" type="date" value={startValue} onChange={(e) => setStartValue(e.target.value)} />
            <TextField id="endDate" label="Hasta" type="date" value={endValue} onChange={(e) => setEndValue(e.target.value)} />
          </div>
          <details className="rounded-lg border border-foreground/10 p-3 text-sm" open={Boolean(pickupTime || returnTime)}>
            <summary className="cursor-pointer select-none font-medium text-foreground/70">
              Horarios de retiro/devolución (opcional)
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-3">
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
              <p className="mt-2 text-xs font-medium text-red-600">La devolución tiene que ser posterior al retiro.</p>
            ) : pickupTime || returnTime ? (
              <p className="mt-2 text-xs text-foreground/60">
                Con esos horarios se factura <span className="font-semibold">{liveDays}</span> día
                {liveDays === 1 ? "" : "s"}.
              </p>
            ) : null}
          </details>
          <TextField
            id="estimatedTotal"
            label="Total estimado"
            type="text"
            inputMode="decimal"
            prefix="$"
            value={totalValue}
            onChange={(e) => setTotalValue(e.target.value)}
          />
          {perDay != null ? <PerDayBox perDay={perDay} days={liveDays} /> : null}
          <TextField id="clientName" label="Cliente" hint="Opcional" type="text" defaultValue={quote.clientName ?? ""} />
          <TextareaField id="note" label="Nota" hint="Opcional" defaultValue={quote.note ?? ""} />
          {editing ? (
            <div>
              <p className="mb-1.5 text-sm font-medium text-foreground/80">Conversación de WhatsApp</p>
              <ConversationPicker options={conversationOptions} selected={conversation} onPick={setConversation} />
            </div>
          ) : quote.conversationId ? (
            <Link href={`/whatsapp/${quote.conversationId}`} className="text-indigo-600 hover:underline dark:text-indigo-400">
              🔗 Ver conversación de WhatsApp
            </Link>
          ) : null}
        </fieldset>

        <p className="text-xs text-foreground/45">
          {quote.createdByName ? `Cargado por ${quote.createdByName}` : "Cargado por un compañero"}
        </p>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {confirmDelete ? (
          <div key="confirm-delete" className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
            <p className="text-sm text-red-700 dark:text-red-400">¿Eliminar este presupuesto?</p>
            <div className="mt-2 flex gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setConfirmDelete(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button type="button" className="flex-1 bg-red-600 hover:bg-red-700" onClick={handleDelete} disabled={pending}>
                {pending ? "Eliminando…" : "Sí, eliminar"}
              </Button>
            </div>
          </div>
        ) : editing ? (
          // `key` distinto del bloque de abajo a propósito: sin esto, React
          // reutiliza el mismo <button> de "Editar" (type="button") para
          // "Guardar cambios" (type="submit") — mutar el type en el mismo
          // click que lo activó hacía que el navegador tratara ese click
          // como un submit real del form, guardando y cerrando el modal
          // antes de que el empleado llegara a tocar nada.
          <div key="editing-actions" className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setEditing(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={pending || timesInvalid}>
              {pending ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        ) : (
          <div key="default-actions" className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setConfirmDelete(true)}>
              Eliminar
            </Button>
            <Button type="button" className="flex-1" onClick={() => setEditing(true)}>
              Editar
            </Button>
          </div>
        )}
      </form>
    </Modal>
  );
}
