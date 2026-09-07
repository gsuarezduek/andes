"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatDateTime } from "@/lib/datetime";
import { Badge } from "@/components/ui/badge";
import type { listConversations } from "@/lib/whatsapp/conversations";

type Conversation = Awaited<ReturnType<typeof listConversations>>[number];

function preview(message: { body: string | null; mediaId: string | null } | null): string {
  if (!message) return "Sin mensajes todavía";
  if (message.body) return message.body;
  if (message.mediaId) return "📎 Adjunto";
  return "—";
}

/** Filtra en el momento por nombre del cliente o teléfono — sin ida y vuelta al servidor. */
export function ConversationList({ conversations }: { conversations: Conversation[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) => (c.customer?.name?.toLowerCase().includes(q) ?? false) || c.phoneE164.toLowerCase().includes(q),
    );
  }, [query, conversations]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
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
          placeholder="Buscar por nombre o teléfono…"
          className="h-11 w-full rounded-lg border border-foreground/15 bg-transparent pl-9 pr-3 text-base outline-none focus:border-foreground/40"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-foreground/10 px-4 py-3 text-sm text-foreground/50">
          Sin coincidencias.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
          {filtered.map((c) => (
            <li key={c.id}>
              <Link
                href={`/whatsapp/${c.id}`}
                className={`flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-foreground/[0.03] ${
                  c.needsReply ? "bg-amber-500/5 dark:bg-amber-500/10" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{c.customer?.name || c.phoneE164}</p>
                    {c.needsReply ? <Badge tone="amber">No leído</Badge> : null}
                    {!c.botEnabled ? <Badge tone="red">Bot apagado</Badge> : null}
                  </div>
                  <p className="truncate text-sm text-foreground/60">{preview(c.lastMessage)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                  {c.lastMessageAt ? (
                    <span className="text-xs text-foreground/50">{formatDateTime(c.lastMessageAt)}</span>
                  ) : null}
                  {c.assignedTo ? <span className="text-xs text-foreground/50">{c.assignedTo.name}</span> : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
