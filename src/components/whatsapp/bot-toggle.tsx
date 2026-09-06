"use client";

import { useTransition } from "react";
import { toggleConversationBot } from "@/app/(app)/whatsapp/actions";

/** "Tomar el control"/"Devolver al bot" — apaga/prende el bot para esta conversación puntual. */
export function BotToggle({ conversationId, botEnabled }: { conversationId: string; botEnabled: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => toggleConversationBot(conversationId, !botEnabled))}
      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
        botEnabled
          ? "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-400"
          : "bg-foreground/10 text-foreground/60 hover:bg-foreground/15"
      }`}
    >
      {botEnabled ? "🤖 Bot activo — tomar el control" : "Devolver al bot"}
    </button>
  );
}
