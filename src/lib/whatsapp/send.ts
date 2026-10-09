import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage";
import { getDecryptedAccount } from "@/lib/whatsapp/settings";
import { sendSessionTextMessage, sendTemplateMessage, uploadMedia, sendMediaByMetaId } from "@/lib/whatsapp/chakra";
import { classifyOutboundAttachment } from "@/lib/whatsapp/attachment-kind";

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/3gpp": "3gp",
  "application/pdf": "pdf",
};
function extensionForMime(mime: string): string {
  return EXTENSION_BY_MIME[mime] ?? (mime.split("/")[1] || "bin").replace(/[^a-z0-9]/gi, "");
}

export const SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;

async function requireAccount() {
  const account = await getDecryptedAccount();
  if (!account) throw new Error("No hay ninguna cuenta de WhatsApp conectada. Configurala primero en Configuración → WhatsApp.");
  return account;
}

/** Conversación + chequeo de ventana de 24hs, compartido por texto y adjuntos. */
async function requireOpenWindow(conversationId: string) {
  const conversation = await prisma.whatsAppConversation.findUniqueOrThrow({ where: { id: conversationId } });
  const withinWindow =
    conversation.lastInboundAt && Date.now() - conversation.lastInboundAt.getTime() < SESSION_WINDOW_MS;
  if (!withinWindow) {
    throw new Error(
      "Pasaron más de 24hs desde el último mensaje del cliente — hay que retomar la conversación con una plantilla.",
    );
  }
  return conversation;
}

async function sendOutboundText(
  conversationId: string,
  text: string,
  sender: { sentById?: string; sentByName?: string; sentByBot?: boolean },
) {
  const conversation = await requireOpenWindow(conversationId);
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
        sentByName: sender.sentByName,
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
export async function sendTextMessage(conversationId: string, text: string, userId: string, userName: string) {
  await sendOutboundText(conversationId, text, { sentById: userId, sentByName: userName });
}

/** Respuesta automática del bot de IA. Mismas reglas de ventana que un mensaje humano. */
export async function sendBotTextMessage(conversationId: string, text: string) {
  await sendOutboundText(conversationId, text, { sentByBot: true });
}

/**
 * Foto/video/documento que manda un miembro del equipo, con caption opcional
 * (mismas reglas de ventana de 24hs que un mensaje de texto). Primero sube y
 * manda por la Cloud API (ver chakra.ts) y solo si eso funciona guarda una
 * copia propia (R2, bajo `whatsapp/`, mismo prefijo que los adjuntos
 * entrantes) + el registro en `WhatsAppMedia`/`WhatsAppMessage` — así un
 * envío que falla no deja basura (adjunto guardado, mensaje nunca mandado).
 */
export async function sendMediaMessage(
  conversationId: string,
  file: { buffer: Buffer; mimeType: string; filename: string },
  caption: string | undefined,
  userId: string,
  userName: string,
) {
  const conversation = await requireOpenWindow(conversationId);
  const account = await requireAccount();
  const { waType, kind } = classifyOutboundAttachment(file.mimeType);

  const { mediaId } = await uploadMedia(account, file);
  const { waMessageId } = await sendMediaByMetaId(account, conversation.phoneE164, {
    waType,
    mediaId,
    caption,
    filename: file.filename,
  });

  const id = randomUUID();
  const key = `whatsapp/${id}.${extensionForMime(file.mimeType)}`;
  await storage().put(key, file.buffer, file.mimeType);

  const now = new Date();
  await prisma.$transaction([
    prisma.whatsAppMedia.create({ data: { id, storageKey: key, mimeType: file.mimeType, kind } }),
    prisma.whatsAppMessage.create({
      data: {
        conversationId,
        waMessageId,
        direction: "out",
        body: caption || null,
        mediaId: id,
        sentById: userId,
        sentByName: userName,
      },
    }),
    prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: now, lastOutboundAt: now },
    }),
  ]);
}

/** Retoma la conversación con una plantilla aprobada — la única forma fuera de la ventana de 24hs. */
export async function reopenWithTemplate(
  conversationId: string,
  templateId: string,
  variables: string[],
  userId: string,
  userName: string,
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
        sentByName: userName,
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
