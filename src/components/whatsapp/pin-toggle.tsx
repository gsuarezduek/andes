"use client";

import { useTransition } from "react";
import { toggleConversationPinned } from "@/app/(app)/whatsapp/actions";
import { PinIcon } from "@/components/ui/icons";

/**
 * Fijar/quitar fijado de una conversación — propio de Andes (no espeja el
 * pin de WhatsApp: esa función no la expone la API, ver conversación con el
 * dueño). Se usa tanto en el listado (dentro de un <Link>, por eso corta la
 * navegación) como en el detalle de la conversación.
 */
export function PinToggle({
  conversationId,
  pinned,
  className = "",
}: {
  conversationId: string;
  pinned: boolean;
  className?: string;
}) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        start(() => toggleConversationPinned(conversationId, !pinned));
      }}
      title={pinned ? "Quitar de fijadas" : "Fijar conversación"}
      aria-label={pinned ? "Quitar de fijadas" : "Fijar conversación"}
      aria-pressed={pinned}
      className={`shrink-0 rounded-full p-1 transition-colors ${
        pinned
          ? "text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
          : "text-foreground/25 hover:bg-foreground/5 hover:text-foreground/50"
      } ${className}`}
    >
      <PinIcon filled={pinned} />
    </button>
  );
}
