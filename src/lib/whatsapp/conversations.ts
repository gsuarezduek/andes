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

/**
 * Cantidad de conversaciones pendientes de respuesta — para el badge de
 * WhatsApp en el menú de navegación (mismo criterio que `taskCount`).
 * Se acota a conversaciones con algún entrante (`needsReply` siempre da
 * `false` sin eso) para no traer toda la tabla.
 */
export async function countNeedsReply(): Promise<number> {
  const rows = await prisma.whatsAppConversation.findMany({
    where: { lastInboundAt: { not: null } },
    select: { lastInboundAt: true, lastOutboundAt: true, lastReadAt: true },
  });
  return rows.filter(needsReply).length;
}

/**
 * Vincula (o desvincula, con `rentalId: null`) esta conversación a una
 * reserva puntual — elección explícita del equipo, a diferencia de
 * `findRelatedRentals` (coincidencia automática por teléfono, nunca
 * persistida). Útil para desambiguar cuando hay varias reservas candidatas o
 * el cliente escribe desde un número distinto al cargado en la reserva.
 */
export async function setConversationRental(conversationId: string, rentalId: string | null) {
  await prisma.whatsAppConversation.update({ where: { id: conversationId }, data: { rentalId } });
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

/** Mismo select que `findRelatedRentals` — así ambos bloques (vinculada / candidatas automáticas) renderizan igual. */
const RENTAL_CARD_SELECT = {
  id: true,
  clientName: true,
  status: true,
  bookingConfirmed: true,
  startAt: true,
  endAt: true,
} as const;

export async function getConversation(id: string) {
  return prisma.whatsAppConversation.findUnique({
    where: { id },
    include: {
      customer: true,
      assignedTo: { select: { id: true, name: true } },
      rental: { select: RENTAL_CARD_SELECT },
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
    select: RENTAL_CARD_SELECT,
  });
}
