"use client";

import { useTransition } from "react";
import { toggleConversationBot } from "@/app/(app)/whatsapp/actions";

/**
 * "Tomar el control"/"Devolver al bot" — apaga/prende el bot para esta
 * conversación puntual. `globalEnabled` es el interruptor de toda la cuenta
 * (Configuración/`/whatsapp` → "Bot de IA"): si está apagado, el bot no le
 * responde a nadie sin importar `botEnabled` de esta conversación — mostrar
 * "Bot activo" en ese caso confundía (bug real reportado: aparecía en verde
 * con el bot apagado para toda la cuenta).
 */
export function BotToggle({
  conversationId,
  botEnabled,
  globalEnabled,
}: {
  conversationId: string;
  botEnabled: boolean;
  globalEnabled: boolean;
}) {
  const [pending, start] = useTransition();

  if (!globalEnabled) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => toggleConversationBot(conversationId, !botEnabled))}
        title={botEnabled ? "El bot está apagado para toda la cuenta — activalo en 'Bot de IA'." : "Devolver al bot cuando se reactive."}
        className="rounded-full bg-foreground/10 px-2.5 py-1 text-xs font-medium text-foreground/60 hover:bg-foreground/15"
      >
        Bot apagado (toda la cuenta)
      </button>
    );
  }

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
