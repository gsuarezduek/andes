/**
 * Procesamiento de eventos entrantes del webhook de WhatsApp: dedup por
 * `waMessageId` (los BSP reintentan agresivamente si no reciben 200 rápido),
 * upsert de Customer/Conversation, y descarga best-effort del adjunto si el
 * mensaje trae media (un adjunto que no se pudo descargar no debe tirar
 * abajo el registro del mensaje en sí).
 */

import "server-only";
import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage";
import { getDecryptedAccount, getDecryptedWebhookSecret } from "@/lib/whatsapp/settings";
import { maybeRespondWithBot } from "@/lib/whatsapp/bot/respond";
import {
  verifyWebhookSignature,
  parseInboundEvent,
  downloadMedia,
  type ChakraAccount,
  type InboundMessageEvent,
} from "@/lib/whatsapp/chakra";

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/amr": "amr",
  "video/mp4": "mp4",
  "application/pdf": "pdf",
};

function extensionForMime(mime: string | null | undefined): string {
  return (mime && EXTENSION_BY_MIME[mime]) || "bin";
}

export type WebhookVerdict =
  | { status: "processed"; count: number }
  | { status: "invalid_signature" }
  | { status: "not_configured" };

export async function processWhatsAppWebhook(
  rawBody: string,
  signatureHeader: string | null,
): Promise<WebhookVerdict> {
  const account = await getDecryptedAccount();
  if (!account) return { status: "not_configured" };

  // Sin secreto cargado todavía (recién conectado) se procesa igual, best-effort
  // — conviene cargarlo cuanto antes desde Configuración → WhatsApp.
  const secret = await getDecryptedWebhookSecret();
  if (secret && !verifyWebhookSignature(rawBody, signatureHeader, secret)) {
    return { status: "invalid_signature" };
  }

  const payload: unknown = JSON.parse(rawBody);
  const events = parseInboundEvent(payload);
  for (const event of events) {
    await handleInboundMessage(account, event);
  }
  return { status: "processed", count: events.length };
}

async function handleInboundMessage(account: ChakraAccount, event: InboundMessageEvent) {
  const existing = await prisma.whatsAppMessage.findUnique({ where: { waMessageId: event.waMessageId } });
  if (existing) return;

  // El nombre de perfil de WhatsApp precarga el Customer nuevo, pero nunca
  // pisa un nombre ya cargado a mano en mensajes siguientes (`update: {}`).
  const customer = await prisma.customer.upsert({
    where: { phone: event.fromE164 },
    create: { phone: event.fromE164, name: event.contactName },
    update: {},
  });

  const conversation = await prisma.whatsAppConversation.upsert({
    where: { phoneE164: event.fromE164 },
    create: {
      phoneE164: event.fromE164,
      customerId: customer.id,
      lastMessageAt: event.timestamp,
      lastInboundAt: event.timestamp,
    },
    update: { lastMessageAt: event.timestamp, lastInboundAt: event.timestamp, customerId: customer.id },
  });

  let mediaId: string | undefined;
  if (event.media) {
    try {
      const { buffer, mimeType } = await downloadMedia(account, event.media.mediaId);
      const resolvedMime = mimeType || event.media.mimeType || "application/octet-stream";
      const id = randomUUID();
      const key = `whatsapp/${id}.${extensionForMime(resolvedMime)}`;
      await storage().put(key, buffer, resolvedMime);
      await prisma.whatsAppMedia.create({
        data: { id, storageKey: key, mimeType: resolvedMime, kind: event.media.kind },
      });
      mediaId = id;
    } catch {
      // Best-effort: si falla la descarga, el mensaje queda igual sin adjunto.
    }
  }

  await prisma.whatsAppMessage.create({
    data: {
      conversationId: conversation.id,
      waMessageId: event.waMessageId,
      direction: "in",
      body: event.text,
      mediaId,
      createdAt: event.timestamp,
    },
  });

  // Fire-and-forget: no bloquea el 200 que espera el BSP (reintenta agresivo
  // si tarda). Un fallo del bot no debe romper la confirmación del webhook.
  after(() => maybeRespondWithBot(conversation.id).catch((err) => console.error("whatsapp bot failed", err)));
}
