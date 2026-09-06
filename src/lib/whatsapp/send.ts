import "server-only";
import { prisma } from "@/lib/prisma";
import { getDecryptedAccount } from "@/lib/whatsapp/settings";
import { sendSessionTextMessage, sendTemplateMessage } from "@/lib/whatsapp/chakra";

export const SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;

async function requireAccount() {
  const account = await getDecryptedAccount();
  if (!account) throw new Error("No hay ninguna cuenta de WhatsApp conectada. Configurala primero en Configuración → WhatsApp.");
  return account;
}

async function sendOutboundText(
  conversationId: string,
  text: string,
  sender: { sentById?: string; sentByBot?: boolean },
) {
  const conversation = await prisma.whatsAppConversation.findUniqueOrThrow({ where: { id: conversationId } });
  const withinWindow =
    conversation.lastInboundAt && Date.now() - conversation.lastInboundAt.getTime() < SESSION_WINDOW_MS;
  if (!withinWindow) {
    throw new Error(
      "Pasaron más de 24hs desde el último mensaje del cliente — hay que retomar la conversación con una plantilla.",
    );
  }

  const account = await requireAccount();
  const { waMessageId } = await sendSessionTextMessage(account, conversation.phoneE164, text);

  const now = new Date();
  await prisma.$transaction([
    prisma.whatsAppMessage.create({
      data: {
        conversationId,
        waMessageId,
        direction: "out",
        body: text,
        sentById: sender.sentById,
        sentByBot: sender.sentByBot ?? false,
      },
    }),
    prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: now, lastOutboundAt: now },
    }),
  ]);
}

/** Mensaje de texto libre de un miembro del equipo. Solo dentro de la ventana de 24hs. */
export async function sendTextMessage(conversationId: string, text: string, userId: string) {
  await sendOutboundText(conversationId, text, { sentById: userId });
}

/** Respuesta automática del bot de IA. Mismas reglas de ventana que un mensaje humano. */
export async function sendBotTextMessage(conversationId: string, text: string) {
  await sendOutboundText(conversationId, text, { sentByBot: true });
}

/** Retoma la conversación con una plantilla aprobada — la única forma fuera de la ventana de 24hs. */
export async function reopenWithTemplate(
  conversationId: string,
  templateId: string,
  variables: string[],
  userId: string,
) {
  const [conversation, template] = await Promise.all([
    prisma.whatsAppConversation.findUniqueOrThrow({ where: { id: conversationId } }),
    prisma.whatsAppTemplate.findUniqueOrThrow({ where: { id: templateId } }),
  ]);
  if (template.status !== "APPROVED") {
    throw new Error("Esa plantilla todavía no está aprobada por Meta.");
  }
  if (variables.length !== template.variableCount) {
    throw new Error(`La plantilla espera ${template.variableCount} variable(s), se recibieron ${variables.length}.`);
  }

  const account = await requireAccount();
  const { waMessageId } = await sendTemplateMessage(
    account,
    conversation.phoneE164,
    { name: template.name, language: template.language },
    variables,
  );

  const now = new Date();
  await prisma.$transaction([
    prisma.whatsAppMessage.create({
      data: {
        conversationId,
        waMessageId,
        direction: "out",
        body: null,
        sentById: userId,
        viaTemplate: true,
        templateName: template.name,
      },
    }),
    prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: now, lastOutboundAt: now },
    }),
  ]);
}
