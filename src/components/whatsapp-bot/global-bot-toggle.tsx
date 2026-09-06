"use client";

import { useTransition } from "react";
import { toggleGlobalBot } from "@/app/(app)/settings/whatsapp/bot/actions";

/** Prende/apaga el bot para TODAS las conversaciones — switch rápido en el inbox de WhatsApp, sin abrir Configuración. */
export function GlobalBotToggle({ enabled }: { enabled: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => toggleGlobalBot(!enabled))}
      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
        enabled
          ? "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-400"
          : "bg-foreground/10 text-foreground/60 hover:bg-foreground/15"
      }`}
    >
      {enabled ? "Activo" : "Apagado"}
    </button>
  );
}
