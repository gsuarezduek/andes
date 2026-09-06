/**
 * Orquesta la respuesta automática a un mensaje entrante. Se llama
 * fire-and-forget desde el webhook (`after()`, no bloquea el ack rápido que
 * espera Chakra/Meta) apenas se persiste el mensaje del cliente.
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import { sendBotTextMessage } from "@/lib/whatsapp/send";
import { generateBotReply, type TranscriptTurn } from "@/lib/whatsapp/bot/reply";
import { findMatch } from "@/lib/whatsapp/bot/security";
import { buildKnowledgeBlock } from "@/lib/whatsapp/bot/knowledge";
import { findRentalContext, formatRentalContextLine } from "@/lib/whatsapp/bot/rental-context";

const DEFAULT_HANDOFF_MESSAGE =
  "Gracias por escribirnos. Ya le paso tu consulta a alguien del equipo para que te ayude en breve.";
const TRANSCRIPT_LIMIT = 20;

export async function maybeRespondWithBot(conversationId: string): Promise<void> {
  const config = await prisma.whatsAppBotConfig.findUnique({ where: { id: 1 } });
  if (!config?.enabled) return;

  const conversation = await prisma.whatsAppConversation.findUnique({ where: { id: conversationId } });
  if (!conversation || !conversation.botEnabled) return;

  // Un humano ya intervino en esta conversación puntual (desde Andes o a
  // mano desde la app/WhatsApp Web): el bot no vuelve a meterse aunque nadie
  // haya tocado el toggle a mano.
  if (config.onlyNewConversations) {
    const humanReplied = await prisma.whatsAppMessage.findFirst({
      where: { conversationId, OR: [{ sentById: { not: null } }, { sentViaApp: true }] },
    });
    if (humanReplied) return;
  }

  const messages = await prisma.whatsAppMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: TRANSCRIPT_LIMIT,
  });
  messages.reverse(); // orden cronológico

  const lastClientText = messages.filter((m) => m.direction === "in").at(-1)?.body ?? "";
  const escalationWords = config.escalationWords as string[];
  const preMatch = findMatch(lastClientText, escalationWords);
  if (preMatch) {
    await handoff(conversationId, config.handoffMessage, {
      trigger: "escalation_word",
      reason: `El mensaje del cliente contiene: "${preMatch}".`,
      clientMessage: lastClientText,
    });
    return;
  }

  const transcript: TranscriptTurn[] = messages
    .map((m): TranscriptTurn | null => {
      if (m.direction === "in") return { role: "user", content: m.body || "[el cliente mandó un adjunto]" };
      return m.body ? { role: "assistant", content: m.body } : null;
    })
    .filter((t): t is TranscriptTurn => t !== null);
  if (transcript.length === 0) return;

  const [knowledgeBlock, rental, customer] = await Promise.all([
    buildKnowledgeBlock(),
    findRentalContext(conversation.phoneE164),
    conversation.customerId ? prisma.customer.findUnique({ where: { id: conversation.customerId } }) : null,
  ]);
  const contextLine = [
    customer?.name ? `El cliente se llama ${customer.name}.` : "Todavía no se sabe el nombre del cliente.",
    formatRentalContextLine(rental) ?? "No tiene ningún alquiler activo o reservado registrado en el sistema.",
  ].join(" ");

  let result;
  try {
    result = await generateBotReply({
      config: {
        prompt: config.prompt,
        blockedWords: config.blockedWords as string[],
        escalationWords,
        examples: config.examples as { question: string; answer: string }[],
      },
      knowledgeBlock,
      contextLine,
      transcript,
    });
  } catch (err) {
    // Best-effort: si Claude falla, no se manda nada — la conversación queda
    // como cualquier mensaje entrante sin responder, un humano la ve en el inbox.
    console.error("whatsapp bot: generateBotReply failed", err);
    return;
  }

  if (result.escalate) {
    await handoff(conversationId, config.handoffMessage, {
      trigger: result.escalateTrigger ?? "confidence",
      reason: result.escalateReason,
      clientMessage: lastClientText,
    });
    return;
  }

  await sendBotTextMessage(conversationId, result.reply);
}

async function handoff(
  conversationId: string,
  handoffMessage: string | null,
  escalation: { trigger: string; reason: string | null; clientMessage: string },
) {
  await sendBotTextMessage(conversationId, handoffMessage || DEFAULT_HANDOFF_MESSAGE).catch((err) => {
    console.error("whatsapp bot: handoff message failed to send", err);
  });
  await prisma.$transaction([
    prisma.whatsAppConversation.update({ where: { id: conversationId }, data: { botEnabled: false } }),
    prisma.whatsAppBotEscalation.create({
      data: {
        conversationId,
        trigger: escalation.trigger,
        reason: escalation.reason,
        clientMessage: escalation.clientMessage || null,
      },
    }),
  ]);
}
