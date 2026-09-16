"use client";

import { useTransition } from "react";
import {
  toggleConversationConfirm,
  toggleConversationFollowUp,
  toggleConversationConfirmed,
  toggleConversationTransferred,
} from "@/app/(app)/whatsapp/actions";

/**
 * Escape manual para "A confirmar"/"Transferido"/"A recuperar"/"Confirmado".
 * Los tres primeros los prende el bot solo (ver whatsapp/bot/respond.ts) y
 * se resuelven solos casi siempre (vincular reserva / el cliente vuelve a
 * escribir / reactivar el bot, ver conversationState en conversations.ts),
 * pero conviene poder prenderlos/apagarlos a mano para los casos que el bot
 * no vio o clasificó mal. "Confirmado" es 100% manual — pensado para
 * clientes frecuentes donde ya está todo arreglado y no hace falta que siga
 * apareciendo como pendiente.
 */
export function ConversationStateToggles({
  conversationId,
  confirming,
  transferring,
  followingUp,
  confirmed,
}: {
  conversationId: string;
  confirming: boolean;
  transferring: boolean;
  followingUp: boolean;
  confirmed: boolean;
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
        onClick={() => start(() => toggleConversationTransferred(conversationId, !transferring))}
        className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
          transferring
            ? "bg-red-500/15 text-red-700 hover:bg-red-500/25 dark:text-red-400"
            : "bg-foreground/5 text-foreground/50 hover:bg-foreground/10"
        }`}
      >
        {transferring ? "✓ Transferido" : "Marcar \"Transferido\""}
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
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => toggleConversationConfirmed(conversationId, !confirmed))}
        className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
          confirmed
            ? "bg-violet-500/15 text-violet-700 hover:bg-violet-500/25 dark:text-violet-400"
            : "bg-foreground/5 text-foreground/50 hover:bg-foreground/10"
        }`}
      >
        {confirmed ? "✓ Confirmado" : "Marcar \"Confirmado\""}
      </button>
    </div>
  );
}
