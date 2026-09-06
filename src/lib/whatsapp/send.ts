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

/** Mensaje de texto libre. Solo dentro de la ventana de 24hs desde el último mensaje del cliente. */
export async function sendTextMessage(conversationId: string, text: string, userId: string) {
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

  await prisma.$transaction([
    prisma.whatsAppMessage.create({
      data: { conversationId, waMessageId, direction: "out", body: text, sentById: userId },
    }),
    prisma.whatsAppConversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } }),
  ]);
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
    prisma.whatsAppConversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } }),
  ]);
}
