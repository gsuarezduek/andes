"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { TextField, TextareaField } from "@/components/ui/fields";
import { ConversationPicker } from "@/components/whatsapp/conversation-picker";
import type { ConversationPickerOption } from "@/lib/rental-quotes";
import type { CalendarColumn, CalendarRow } from "@/lib/calendar";
import { estimateQuoteTotal } from "@/lib/quote-estimate";
import { formatArs } from "@/lib/contract";
import { createQuote } from "./actions";

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
  onClose,
}: {
  vehicleId: string;
  startIndex: number;
  endIndex: number;
  row: CalendarRow;
  columns: CalendarColumn[];
  conversationOptions: ConversationPickerOption[];
  onClose: () => void;
}) {
  const days = endIndex - startIndex + 1;
  const startKey = columns[startIndex]!.key;
  const endKey = columns[endIndex]!.key;
  const rangeDays = columns.slice(startIndex, endIndex + 1);
  // Temporadas de ESTE auto puntual (row.seasonsByDay, filtrado por
  // wpCarId) — no `CalendarColumn.seasons`, que es fleet-wide y solo
  // alimenta el marcador visual del encabezado.
  const daySeasons = row.seasonsByDay.slice(startIndex, endIndex + 1);
  const suggested = estimateQuoteTotal(row.dailyRate, row.todaySeasons, daySeasons);
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

  const [total, setTotal] = useState(suggested != null ? String(suggested) : "");
  const [conversation, setConversation] = useState<ConversationPickerOption | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    const data = new FormData(e.currentTarget);
    data.set("vehicleId", vehicleId);
    data.set("startDate", startKey);
    data.set("days", String(days));
    if (conversation) data.set("conversationId", conversation.id);
    start(async () => {
      try {
        await createQuote(data);
        onClose();
        router.refresh();
      } catch {
        setError("No se pudo guardar el presupuesto.");
      }
    });
  }

  return (
    <Modal open onClose={onClose} title="Nuevo presupuesto" className="max-w-md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="rounded-lg border border-foreground/10 bg-foreground/[0.03] p-3 text-sm">
          <p className="font-semibold">{row.name ?? row.plate ?? row.label}</p>
          <p className="text-foreground/60">
            {fmtShortDate(startKey)} al {fmtShortDate(endKey)} · {days} día{days === 1 ? "" : "s"}
          </p>
        </div>

        {conflicts.length > 0 ? (
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
          label="Total estimado"
          hint={
            suggested != null
              ? `Sugerido: ${formatArs(suggested)} (tarifa × días${seasonDaysInRange.length > 0 ? ", con temporada" : ""})`
              : "Sin tarifa cargada para este auto"
          }
          type="text"
          inputMode="decimal"
          prefix="$"
          value={total}
          onChange={(e) => setTotal(e.target.value)}
        />
        <TextField id="clientName" label="Cliente" hint="Opcional" type="text" />
        <TextareaField id="note" label="Nota" hint="Opcional" />

        <div>
          <p className="mb-1.5 text-sm font-medium text-foreground/80">Conversación de WhatsApp</p>
          <ConversationPicker options={conversationOptions} selected={conversation} onPick={setConversation} />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" disabled={pending}>
            {pending ? "Guardando…" : "Guardar presupuesto"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
