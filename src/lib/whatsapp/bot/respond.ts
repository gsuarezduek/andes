/**
 * Orquesta la respuesta automática a un mensaje entrante. Se llama
 * fire-and-forget desde el webhook (`after()`, no bloquea el ack rápido que
 * espera Chakra/Meta) apenas se persiste el mensaje del cliente.
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/whatsapp/phone";
import { sendBotTextMessage } from "@/lib/whatsapp/send";
import { generateBotReply, type BotTools, type TranscriptTurn } from "@/lib/whatsapp/bot/reply";
import { findMatch } from "@/lib/whatsapp/bot/security";
import { buildKnowledgeBlock } from "@/lib/whatsapp/bot/knowledge";
import { findRentalContext, formatRentalContextLine, todayContextLine } from "@/lib/whatsapp/bot/rental-context";
import { checkAvailability } from "@/lib/whatsapp/bot/availability";
import { findMyReservations } from "@/lib/whatsapp/bot/my-reservations";
import { setPendingConfirmation, setFollowUp } from "@/lib/whatsapp/conversations";

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
  // haya tocado el toggle a mano. Los teléfonos de entrenamiento son la
  // excepción a propósito — permiten seguir probando el bot desde un número
  // propio sin que la primera respuesta manual lo calle para siempre.
  const isTrainingPhone = (config.trainingPhones as string[]).some(
    (p) => normalizePhone(p) === normalizePhone(conversation.phoneE164),
  );
  if (config.onlyNewConversations && !isTrainingPhone) {
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

  const [knowledgeBlock, rental, customer, conditions] = await Promise.all([
    buildKnowledgeBlock(),
    findRentalContext(conversation.phoneE164),
    conversation.customerId ? prisma.customer.findUnique({ where: { id: conversation.customerId } }) : null,
    prisma.conditionSettings.findUnique({ where: { id: 1 } }),
  ]);
  const contextLine = [
    customer?.name ? `El cliente se llama ${customer.name}.` : "Todavía no se sabe el nombre del cliente.",
    formatRentalContextLine(rental) ?? "No tiene ningún alquiler activo o reservado registrado en el sistema.",
    todayContextLine(),
  ].join(" ");

  // El teléfono de la reserva SIEMPRE es el de esta conversación — nunca un
  // parámetro que el modelo pueda controlar (ver my-reservations.ts).
  const tools: BotTools = {
    checkAvailability: (i) => checkAvailability(i),
    getMyReservations: (i) => findMyReservations({ phoneE164: conversation.phoneE164, ...i }),
  };

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
      conditions: conditions
        ? {
            kmPerDay: conditions.kmPerDay,
            extraKmRate: conditions.extraKmRate != null ? Number(conditions.extraKmRate) : null,
            deductible: conditions.deductible != null ? Number(conditions.deductible) : null,
            deductibleReduced: conditions.deductibleReduced != null ? Number(conditions.deductibleReduced) : null,
          }
        : null,
      policies: config.policies as { topic: string; text: string }[],
      contextLine,
      transcript,
      tools,
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

  // "outcome" solo prende estos flags — nunca los apaga desde acá: se
  // resuelven solos (vincular reserva / el cliente vuelve a escribir, ver
  // conversationState en conversations.ts) o a mano desde el hilo. Un
  // "none" en un mensaje posterior no debe borrar lo que ya se marcó antes.
  if (result.outcome === "client_accepted") {
    await setPendingConfirmation(conversationId, true).catch((err) => {
      console.error("whatsapp bot: setPendingConfirmation failed", err);
    });
  } else if (result.outcome === "awaiting_client") {
    await setFollowUp(conversationId, true).catch((err) => {
      console.error("whatsapp bot: setFollowUp failed", err);
    });
  }
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
