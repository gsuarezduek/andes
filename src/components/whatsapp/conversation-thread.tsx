"use client";

import { useMemo, useState } from "react";
import { MessageBubble, type MessageData } from "@/components/whatsapp/message-bubble";
import { SendForm } from "@/components/whatsapp/send-form";
import { ReopenForm } from "@/components/whatsapp/reopen-form";
import { ScrollToBottom } from "@/components/whatsapp/scroll-to-bottom";
import { SearchIcon } from "@/components/ui/icons";
import type { QuickReplyOption } from "@/lib/whatsapp/quick-replies";

type TemplateOption = { id: string; name: string; language: string; variableCount: number };

// Solo con bastantes mensajes tiene sentido mostrar el buscador — con pocos,
// es más ruido que ayuda (mismo criterio que el buscador de Tareas, v62).
const MIN_MESSAGES_TO_SEARCH = 6;

/**
 * Hilo de mensajes + compositor (o el form de retomar con plantilla si la
 * ventana de 24hs está cerrada). Compartido entre `/whatsapp/[id]` y la
 * pestaña "WhatsApp" del detalle de una reserva — mismo hilo, dos lugares
 * donde tiene sentido verlo. El buscador filtra y resalta client-side sobre
 * los mensajes ya cargados (sin ida y vuelta al servidor) — a diferencia del
 * buscador de la lista de conversaciones, que sí consulta al servidor, acá
 * ya está todo el historial de esta conversación en memoria.
 */
export function ConversationThread({
  conversationId,
  messages,
  windowOpen,
  templates,
  quickReplies,
}: {
  conversationId: string;
  messages: MessageData[];
  windowOpen: boolean;
  templates: TemplateOption[];
  quickReplies: QuickReplyOption[];
}) {
  const [query, setQuery] = useState("");
  const q = query.trim();
  const filtered = useMemo(
    () => (q ? messages.filter((m) => m.body?.toLowerCase().includes(q.toLowerCase())) : messages),
    [messages, q],
  );

  return (
    <section className="flex flex-1 flex-col gap-3 rounded-xl border border-foreground/10 p-4">
      <ScrollToBottom />

      {messages.length >= MIN_MESSAGES_TO_SEARCH ? (
        <div className="flex flex-col gap-1">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/40" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar en esta conversación…"
              className="h-9 w-full rounded-lg border border-foreground/15 bg-transparent pl-9 pr-3 text-sm outline-none focus:border-foreground/40"
            />
          </div>
          {q ? (
            <p className="text-xs text-foreground/50">
              {filtered.length === 0
                ? `Sin resultados para "${q}".`
                : `${filtered.length} mensaje${filtered.length === 1 ? "" : "s"} con "${q}".`}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-foreground/50">
            {q ? "No se encontraron mensajes." : "Todavía no hay mensajes."}
          </p>
        ) : (
          filtered.map((m) => <MessageBubble key={m.id} message={m} highlightQuery={q || undefined} />)
        )}
      </div>

      {windowOpen ? (
        <SendForm conversationId={conversationId} quickReplies={quickReplies} />
      ) : (
        <ReopenForm conversationId={conversationId} templates={templates} />
      )}
    </section>
  );
}
