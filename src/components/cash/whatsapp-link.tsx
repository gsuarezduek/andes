"use client";

import Link from "next/link";

/**
 * Link directo a la conversación de WhatsApp de este proveedor/asociado (ver
 * `ThirdPartyBalance.whatsappConversationId`). `stopPropagation` porque
 * `AssociateCard` lo pone dentro de un `<summary>` — sin esto, el click
 * navegaba Y además abría/cerraba la tarjeta.
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
