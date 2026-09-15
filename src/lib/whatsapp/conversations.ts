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

export type ConversationState = "confirm" | "unread" | "confirmed" | "followup" | "read";

/**
 * Estado de triage de la conversación, en orden de prioridad de arriba hacia
 * abajo: "confirm" (el bot detectó que el cliente aceptó una propuesta y
 * falta armar la reserva) > "unread" (needsReply) > "confirmed" (marcado a
 * mano, ver `setConfirmed`) > "followup" (cotizamos, esperamos que el
 * cliente responda) > "read" (todo lo demás). Vincular una reserva o marcar
 * "confirmed" resuelven "confirm"/"followup" por igual (`setConversationRental`/
 * `setConfirmed` ya limpian esos campos al hacerlo) — los chequeos
 * `!c.rentalId` de acá son una segunda capa por si queda algún dato viejo de
 * antes de ese fix.
 */
export function conversationState(c: {
  rentalId: string | null;
  pendingConfirmationAt: Date | null;
  followUpAt: Date | null;
  confirmedAt: Date | null;
  lastInboundAt: Date | null;
  lastOutboundAt: Date | null;
  lastReadAt: Date | null;
}): ConversationState {
  if (c.pendingConfirmationAt && !c.rentalId) return "confirm";
  if (needsReply(c)) return "unread";
  if (c.confirmedAt) return "confirmed";
  const clientRepliedSince = c.lastInboundAt != null && c.lastInboundAt.getTime() > (c.followUpAt?.getTime() ?? -Infinity);
  if (c.followUpAt && !c.rentalId && !clientRepliedSince) return "followup";
  return "read";
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
 *
 * Al vincular, limpia `pendingConfirmationAt`/`followUpAt`: antes solo se
 * "ignoraban" en `conversationState()` pero quedaban prendidos en la base,
 * así que el botón manual de "A recuperar"/"A confirmar" (que lee el campo
 * crudo, no el estado calculado) seguía apareciendo activo aunque ya hubiera
 * una reserva confirmada — bug real reportado por el dueño.
 */
export async function setConversationRental(conversationId: string, rentalId: string | null) {
  await prisma.whatsAppConversation.update({
    where: { id: conversationId },
    data: rentalId ? { rentalId, pendingConfirmationAt: null, followUpAt: null } : { rentalId },
  });
}

const STATE_PRIORITY: Record<ConversationState, number> = { confirm: 0, unread: 1, confirmed: 2, followup: 3, read: 4 };

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
    .map(({ messages, ...c }) => ({
      ...c,
      lastMessage: messages[0] ?? null,
      needsReply: needsReply(c),
      state: conversationState(c),
    }))
    .sort((a, b) => {
      // Fijadas primero (siempre) — mismo criterio que WhatsApp: un pin gana
      // incluso a "A confirmar". Después, por prioridad de estado.
      const pinDiff = Number(b.pinnedAt != null) - Number(a.pinnedAt != null);
      if (pinDiff !== 0) return pinDiff;
      return STATE_PRIORITY[a.state] - STATE_PRIORITY[b.state];
    });
}

/** Marca/descarta "A confirmar" a mano — el bot lo prende solo (ver reply.ts), esto es el escape manual. */
export async function setPendingConfirmation(conversationId: string, on: boolean) {
  await prisma.whatsAppConversation.update({
    where: { id: conversationId },
    data: { pendingConfirmationAt: on ? new Date() : null },
  });
}

/** Marca/descarta "A recuperar" a mano. */
export async function setFollowUp(conversationId: string, on: boolean) {
  await prisma.whatsAppConversation.update({
    where: { id: conversationId },
    data: { followUpAt: on ? new Date() : null },
  });
}

/**
 * Marca/descarta "Confirmado" a mano — nunca lo prende el bot. Al prenderlo,
 * limpia "A confirmar"/"A recuperar" (mismo criterio que vincular una
 * reserva, ver `setConversationRental`): si ya está confirmado, esos dos ya
 * no aplican. Al apagarlo, no toca nada más.
 */
export async function setConfirmed(conversationId: string, on: boolean) {
  await prisma.whatsAppConversation.update({
    where: { id: conversationId },
    data: on ? { confirmedAt: new Date(), pendingConfirmationAt: null, followUpAt: null } : { confirmedAt: null },
  });
}

/** Fija (o quita el fijado, `pinned: false`) una conversación — propio de Andes, compartido para todo el equipo. */
export async function setConversationPinned(conversationId: string, pinned: boolean) {
  await prisma.whatsAppConversation.update({
    where: { id: conversationId },
    data: { pinnedAt: pinned ? new Date() : null },
  });
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
 * Conversación vinculada a esta reserva (link manual, ver `setConversationRental`)
 * — para la pestaña "WhatsApp" del detalle de la reserva. `findFirst` porque
 * el schema no fuerza 1:1 (`rentalId` no es único); en la práctica solo hay
 * una, y si hubiera más de una se muestra la más activa.
 */
export async function getConversationForRental(rentalId: string) {
  return prisma.whatsAppConversation.findFirst({
    where: { rentalId },
    orderBy: { lastMessageAt: "desc" },
    select: {
      id: true,
      phoneE164: true,
      lastInboundAt: true,
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

/**
 * Vincula sola la conversación cuando `findRelatedRentals` encuentra
 * exactamente UNA candidata — con 0 o 2+ sigue haciendo falta elegir a mano
 * (`linkRental`/`RentalLinkPicker`), para no arriesgar vincular la reserva
 * equivocada cuando hay ambigüedad. Nunca pisa un vínculo ya
 * elegido/quitado a mano: si `rentalId` no es null (haya quedado en algo o
 * se haya quitado explícitamente), no hace nada. Se llama fire-and-forget
 * (`after()`) al llegar un mensaje nuevo y al abrir la conversación — mismo
 * patrón que `markConversationRead`.
 */
export async function autoLinkRentalIfUnambiguous(conversationId: string, phoneE164: string): Promise<void> {
  const conversation = await prisma.whatsAppConversation.findUnique({
    where: { id: conversationId },
    select: { rentalId: true },
  });
  if (!conversation || conversation.rentalId) return;

  const candidates = await findRelatedRentals(phoneE164);
  if (candidates.length !== 1) return;

  await setConversationRental(conversationId, candidates[0].id);
}
