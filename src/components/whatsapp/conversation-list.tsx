"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { formatDateTime } from "@/lib/datetime";
import { Badge } from "@/components/ui/badge";
import { PinToggle } from "@/components/whatsapp/pin-toggle";
import { useDebouncedCallback } from "@/lib/client/use-debounced-callback";
import { searchConversationIdsByMessage } from "@/app/(app)/whatsapp/actions";
import { isFollowUpStale } from "@/lib/whatsapp/follow-up";
import type { listConversations } from "@/lib/whatsapp/conversations";

type Conversation = Awaited<ReturnType<typeof listConversations>>[number];

const STATE_BG: Record<Conversation["state"], string> = {
  confirm: "bg-emerald-500/5 dark:bg-emerald-500/10",
  transfer: "bg-red-500/5 dark:bg-red-500/10",
  unread: "bg-amber-500/5 dark:bg-amber-500/10",
  confirmed: "bg-violet-500/5 dark:bg-violet-500/10",
  followup: "bg-blue-500/5 dark:bg-blue-500/10",
  read: "",
};

function preview(message: { body: string | null; mediaId: string | null } | null): string {
  if (!message) return "Sin mensajes todavía";
  if (message.body) return message.body;
  if (message.mediaId) return "📎 Adjunto";
  return "—";
}

/**
 * Busca por nombre del cliente o teléfono en el momento (sin ida y vuelta al
 * servidor, ya están cargados) y, en paralelo, por texto de los mensajes
 * contra el servidor (con debounce) — el resultado es la unión de ambos, en
 * el mismo buscador. `filters` (los tabs Todas/No leídas) se renderiza en la
 * misma fila para no sumar una fila aparte.
 */
export function ConversationList({
  conversations,
  filters,
  globalBotEnabled,
  followUpStaleDays,
}: {
  conversations: Conversation[];
  filters?: React.ReactNode;
  globalBotEnabled: boolean;
  followUpStaleDays: number;
}) {
  const [query, setQuery] = useState("");
  const [messageMatchIds, setMessageMatchIds] = useState<Set<string> | null>(null);
  const [searching, startSearch] = useTransition();

  const searchMessages = useDebouncedCallback((q: string) => {
    if (q.trim().length < 2) {
      setMessageMatchIds(null);
      return;
    }
    startSearch(async () => {
      const ids = await searchConversationIdsByMessage(q);
      setMessageMatchIds(new Set(ids));
    });
  }, 300);

  useEffect(() => {
    searchMessages(query);
  }, [query, searchMessages]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        (c.customer?.name?.toLowerCase().includes(q) ?? false) ||
        c.phoneE164.toLowerCase().includes(q) ||
        (messageMatchIds?.has(c.id) ?? false),
    );
  }, [query, conversations, messageMatchIds]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {filters}
        <div className="relative min-w-0 sm:flex-1">
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40"
          >
            <circle cx="8.5" cy="8.5" r="6" />
            <path d="M17 17l-4-4" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, teléfono o mensaje…"
            className="h-9 w-full rounded-lg border border-foreground/15 bg-transparent pl-9 pr-3 text-sm outline-none focus:border-foreground/40"
          />
          {searching ? (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-foreground/40">Buscando…</span>
          ) : null}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-foreground/10 px-4 py-3 text-sm text-foreground/50">
          Sin coincidencias.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
          {filtered.map((c) => {
            const stale = c.state === "followup" && isFollowUpStale(c.followUpAt, followUpStaleDays);
            return (
            <li key={c.id}>
              <Link
                href={`/whatsapp/${c.id}`}
                className={`flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-foreground/[0.03] ${
                  stale ? "bg-orange-500/5 dark:bg-orange-500/10" : STATE_BG[c.state]
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{c.customer?.name || c.phoneE164}</p>
                    {c.state === "confirm" ? <Badge tone="emerald">A confirmar</Badge> : null}
                    {c.state === "transfer" ? <Badge tone="red">🚩 Transferido</Badge> : null}
                    {c.state === "unread" ? <Badge tone="amber">No leído</Badge> : null}
                    {c.state === "confirmed" ? <Badge tone="violet">Confirmado</Badge> : null}
                    {c.state === "followup" ? (
                      <Badge tone={stale ? "orange" : "blue"}>{stale ? "Hacer seguimiento · vencido" : "Hacer seguimiento"}</Badge>
                    ) : null}
                    {globalBotEnabled && !c.botEnabled && c.state !== "transfer" ? (
                      <Badge tone="red">Bot apagado</Badge>
                    ) : null}
                  </div>
                  <p className="truncate text-sm text-foreground/60">{preview(c.lastMessage)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                  <div className="flex items-center gap-1.5">
                    {c.lastMessageAt ? (
                      <span className="text-xs text-foreground/50">{formatDateTime(c.lastMessageAt)}</span>
                    ) : null}
                    <PinToggle conversationId={c.id} pinned={c.pinnedAt != null} />
                  </div>
                  {c.assignedTo ? <span className="text-xs text-foreground/50">{c.assignedTo.name}</span> : null}
                </div>
              </Link>
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
