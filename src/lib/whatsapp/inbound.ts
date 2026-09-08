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
import type { WhatsAppMediaKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage";
import { getDecryptedAccount, getDecryptedWebhookSecret } from "@/lib/whatsapp/settings";
import { maybeRespondWithBot } from "@/lib/whatsapp/bot/respond";
import { autoLinkRentalIfUnambiguous } from "@/lib/whatsapp/conversations";
import {
  verifyWebhookSignature,
  parseInboundEvent,
  parseOutboundEchoEvents,
  downloadMedia,
  type ChakraAccount,
  type InboundMessageEvent,
  type OutboundEchoEvent,
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
  const echoes = parseOutboundEchoEvents(payload);
  for (const echo of echoes) {
    await handleOutboundEcho(account, echo);
  }
  return { status: "processed", count: events.length + echoes.length };
}

/** Descarga best-effort un adjunto y lo persiste en `WhatsAppMedia`. Un fallo no debe tirar abajo el mensaje en sí. */
async function downloadAndStoreMedia(
  account: ChakraAccount,
  media: { mediaId: string; mimeType: string | null; kind: WhatsAppMediaKind },
): Promise<string | undefined> {
  try {
    const { buffer, mimeType } = await downloadMedia(account, media.mediaId);
    const resolvedMime = mimeType || media.mimeType || "application/octet-stream";
    const id = randomUUID();
    const key = `whatsapp/${id}.${extensionForMime(resolvedMime)}`;
    await storage().put(key, buffer, resolvedMime);
    await prisma.whatsAppMedia.create({ data: { id, storageKey: key, mimeType: resolvedMime, kind: media.kind } });
    return id;
  } catch {
    return undefined;
  }
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

  const mediaId = event.media ? await downloadAndStoreMedia(account, event.media) : undefined;

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
  after(() =>
    autoLinkRentalIfUnambiguous(conversation.id, event.fromE164).catch((err) =>
      console.error("whatsapp auto-link rental failed", err),
    ),
  );
}

/**
 * Un mensaje mandado a mano desde la app de WhatsApp Business / WhatsApp Web
 * (Coexistence) — no pasó por Andes, así que no hay `sentById` (nadie del
 * equipo lo tipeó acá). Cuenta igual como respuesta: actualiza
 * `lastOutboundAt`, que es lo que saca a la conversación de "pendiente"
 * (ver needsReply en src/lib/whatsapp/conversations.ts). No dispara el bot
 * — no es un mensaje del cliente.
 */
async function handleOutboundEcho(account: ChakraAccount, event: OutboundEchoEvent) {
  const existing = await prisma.whatsAppMessage.findUnique({ where: { waMessageId: event.waMessageId } });
  if (existing) return;

  const customer = await prisma.customer.upsert({
    where: { phone: event.toE164 },
    create: { phone: event.toE164 },
    update: {},
  });

  const conversation = await prisma.whatsAppConversation.upsert({
    where: { phoneE164: event.toE164 },
    create: { phoneE164: event.toE164, customerId: customer.id, lastMessageAt: event.timestamp, lastOutboundAt: event.timestamp },
    update: { lastMessageAt: event.timestamp, lastOutboundAt: event.timestamp, customerId: customer.id },
  });

  const mediaId = event.media ? await downloadAndStoreMedia(account, event.media) : undefined;

  await prisma.whatsAppMessage.create({
    data: {
      conversationId: conversation.id,
      waMessageId: event.waMessageId,
      direction: "out",
      body: event.text,
      mediaId,
      sentViaApp: true,
      createdAt: event.timestamp,
    },
  });
}
