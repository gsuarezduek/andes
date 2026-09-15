"use client";

import { useTransition } from "react";
import { toggleConversationConfirm, toggleConversationFollowUp } from "@/app/(app)/whatsapp/actions";

/**
 * Escape manual para "A confirmar"/"A recuperar" — el bot los prende solo
 * (ver whatsapp/bot/respond.ts) y se resuelven solos casi siempre (vincular
 * reserva / el cliente vuelve a escribir, ver conversationState en
 * conversations.ts), pero conviene poder prenderlos/apagarlos a mano para
 * los casos que el bot no vio o clasificó mal.
 */
export function ConversationStateToggles({
  conversationId,
  confirming,
  followingUp,
}: {
  conversationId: string;
  confirming: boolean;
  followingUp: boolean;
}) {
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => toggleConversationConfirm(conversationId, !confirming))}
        className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
          confirming
            ? "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-400"
            : "bg-foreground/5 text-foreground/50 hover:bg-foreground/10"
        }`}
      >
        {confirming ? "✓ A confirmar" : "Marcar \"A confirmar\""}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => toggleConversationFollowUp(conversationId, !followingUp))}
        className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
          followingUp
            ? "bg-blue-500/15 text-blue-700 hover:bg-blue-500/25 dark:text-blue-400"
            : "bg-foreground/5 text-foreground/50 hover:bg-foreground/10"
        }`}
      >
        {followingUp ? "✓ A recuperar" : "Marcar \"A recuperar\""}
      </button>
    </div>
  );
}
