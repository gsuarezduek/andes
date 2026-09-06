import "server-only";
import { prisma } from "@/lib/prisma";
import { phoneVariants } from "@/lib/whatsapp/phone";
import { SESSION_WINDOW_MS } from "@/lib/whatsapp/send";

export function isSessionWindowOpen(lastInboundAt: Date | null): boolean {
  return Boolean(lastInboundAt && Date.now() - lastInboundAt.getTime() < SESSION_WINDOW_MS);
}

/**
 * "Pendiente de respuesta": llegó un mensaje del cliente que todavía no se
 * contestó (por Andes, el bot, o a mano desde la app — `lastOutboundAt`
 * cubre las tres) NI se vio en Andes (`lastReadAt`). Alcanza con que
 * cualquiera de las dos pase para que deje de estar pendiente — ver pedido
 * del dueño: un mensaje sin abrir en Andes pero ya respondido desde otro
 * lado no debe seguir marcado como pendiente.
 */
export function needsReply(c: { lastInboundAt: Date | null; lastOutboundAt: Date | null; lastReadAt: Date | null }): boolean {
  if (!c.lastInboundAt) return false;
  const answered = c.lastOutboundAt != null && c.lastOutboundAt.getTime() >= c.lastInboundAt.getTime();
  const viewed = c.lastReadAt != null && c.lastReadAt.getTime() >= c.lastInboundAt.getTime();
  return !answered && !viewed;
}

/** Marca el hilo como visto desde Andes — se llama al abrir la conversación (ver [id]/page.tsx). */
export async function markConversationRead(conversationId: string) {
  await prisma.whatsAppConversation.update({ where: { id: conversationId }, data: { lastReadAt: new Date() } });
}

export async function listConversations() {
  const conversations = await prisma.whatsAppConversation.findMany({
    orderBy: { lastMessageAt: "desc" },
    include: {
      customer: true,
      assignedTo: { select: { id: true, name: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  return conversations
    .map(({ messages, ...c }) => ({ ...c, lastMessage: messages[0] ?? null, needsReply: needsReply(c) }))
    .sort((a, b) => Number(b.needsReply) - Number(a.needsReply));
}

export async function getConversation(id: string) {
  return prisma.whatsAppConversation.findUnique({
    where: { id },
    include: {
      customer: true,
      assignedTo: { select: { id: true, name: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { media: true, sentBy: { select: { id: true, name: true } } },
      },
    },
  });
}

/**
 * Reservas cuyo teléfono cargado (VikRentCar o alta manual) coincide con
 * alguna variante plausible del E.164 de esta conversación. Best-effort: no
 * hay FK entre `Rental` y `Customer` (ver nota en el schema), así que este
 * cruce puede no encontrar nada si el teléfono se tipeó muy distinto.
 */
export async function findRelatedRentals(phoneE164: string) {
  return prisma.rental.findMany({
    where: { clientPhone: { in: phoneVariants(phoneE164) } },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, clientName: true, status: true, bookingConfirmed: true, startAt: true, endAt: true },
  });
}
