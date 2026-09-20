import "server-only";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type QuoteInput = {
  vehicleId: string;
  startAt: Date;
  endAt: Date;
  clientName: string | null;
  note: string | null;
  estimatedTotal: number | null;
  conversationId: string | null;
};

export async function createRentalQuote(input: QuoteInput, createdById: string) {
  return prisma.rentalQuote.create({
    data: { ...input, createdById },
  });
}

/** Solo quien creó el presupuesto o un admin puede editarlo/borrarlo — mismo
 *  criterio que `assertCanEditTask` en src/app/(app)/tasks/actions.ts. */
async function assertCanEditQuote(quoteId: string, user: { id: string; role: UserRole }) {
  const quote = await prisma.rentalQuote.findUniqueOrThrow({ where: { id: quoteId } });
  if (quote.createdById !== user.id && user.role !== "admin") {
    throw new Error("Solo quien creó el presupuesto o un admin puede editarlo.");
  }
}

export async function updateRentalQuote(
  id: string,
  input: QuoteInput,
  user: { id: string; role: UserRole },
) {
  await assertCanEditQuote(id, user);
  return prisma.rentalQuote.update({ where: { id }, data: input });
}

export async function deleteRentalQuote(id: string, user: { id: string; role: UserRole }) {
  await assertCanEditQuote(id, user);
  await prisma.rentalQuote.delete({ where: { id } });
}

export type ConversationPickerOption = {
  id: string;
  phoneE164: string;
  customerName: string | null;
  label: string;
};

const MAX_CONVERSATION_OPTIONS = 200;

/** Últimas conversaciones de WhatsApp, para el buscador de "vincular
 *  conversación" del alta de presupuesto — análoga a `getRentalPickerOptions`
 *  (src/lib/cash.ts), en la dirección opuesta a `findRelatedRentals`
 *  (src/lib/whatsapp/conversations.ts, que busca reserva→conversación). */
export async function listConversationPickerOptions(): Promise<ConversationPickerOption[]> {
  const conversations = await prisma.whatsAppConversation.findMany({
    orderBy: { lastMessageAt: "desc" },
    take: MAX_CONVERSATION_OPTIONS,
    select: { id: true, phoneE164: true, customer: { select: { name: true } } },
  });
  return conversations.map((c) => {
    const customerName = c.customer?.name?.trim() || null;
    return {
      id: c.id,
      phoneE164: c.phoneE164,
      customerName,
      label: customerName ? `${customerName} — ${c.phoneE164}` : c.phoneE164,
    };
  });
}
