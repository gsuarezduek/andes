"use client";

import Link from "next/link";

/**
 * Link directo a la conversación de WhatsApp de este proveedor/asociado (ver
 * `ThirdPartyBalance.whatsappConversationId`). Vive como hermano del link de
 * navegación de la tarjeta (`ProviderCard`/`AssociateCard`), nunca anidado
 * adentro — `stopPropagation` queda igual como defensivo por si algún caller
 * futuro sí lo anida en algo clickeable.
 */
export function WhatsappAccountLink({ conversationId }: { conversationId: string | null }) {
  if (!conversationId) return null;
  return (
    <Link
      href={`/whatsapp/${conversationId}`}
      onClick={(e) => e.stopPropagation()}
      className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
    >
      💬 Ver WhatsApp
    </Link>
  );
}
