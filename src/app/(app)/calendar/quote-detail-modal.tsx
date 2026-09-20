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
import { formatDateInput, mendozaWallTimeToUtc } from "@/lib/datetime";
import { formatArs } from "@/lib/contract";
import { updateQuote, deleteQuote } from "./actions";

const DAY_MS = 24 * 60 * 60 * 1000;

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

  const startKey = formatDateInput(quote.startAt);
  const lastDayKey = formatDateInput(new Date(quote.endAt.getTime() - DAY_MS));
  const initialConversation: ConversationPickerOption | null = quote.conversationId
    ? {
        id: quote.conversationId,
        phoneE164: quote.conversationLabel ?? "",
        customerName: null,
        label: quote.conversationLabel ?? "Conversación vinculada",
      }
    : null;
  const [conversation, setConversation] = useState<ConversationPickerOption | null>(initialConversation);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    const data = new FormData(e.currentTarget);
    const startValue = String(data.get("startDate") ?? startKey);
    const lastDayValue = String(data.get("endDateInclusive") ?? lastDayKey);
    const days = Math.max(
      1,
      Math.round(
        (mendozaWallTimeToUtc(`${lastDayValue}T00:00`).getTime() -
          mendozaWallTimeToUtc(`${startValue}T00:00`).getTime()) /
          DAY_MS,
      ) + 1,
    );
    data.set("vehicleId", quote.vehicleId);
    data.set("days", String(days));
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
            <TextField id="startDate" label="Desde" type="date" defaultValue={startKey} />
            <TextField id="endDateInclusive" label="Hasta" type="date" defaultValue={lastDayKey} />
          </div>
          <TextField
            id="estimatedTotal"
            label="Total estimado"
            type="text"
            inputMode="decimal"
            prefix="$"
            defaultValue={quote.estimatedTotal != null ? String(quote.estimatedTotal) : ""}
          />
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
            <Button type="submit" className="flex-1" disabled={pending}>
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
