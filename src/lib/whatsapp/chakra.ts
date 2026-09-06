/**
 * Adaptador hacia Chakra (chakrahq.com), el BSP (Business Solution Provider)
 * que actúa de intermediario hacia la WhatsApp Cloud API de Meta.
 *
 * Verificado contra la documentación pública de Chakra (apidocs.chakrahq.com)
 * el 2026-09-06 — corrigió varios supuestos equivocados de una primera
 * versión basada en una integración hermana no verificada: falta el prefijo
 * `/v1/ext` en las rutas de mensajería/plantillas, la respuesta al enviar es
 * `{ _data: { whatsappMessageId } }` (no el shape nativo de Meta), y el
 * **webhook entrante NO es pass-through del formato nativo de Meta** — es un
 * formato propio de Chakra (`{ event, payload: { messageId, timestamp en
 * MILISEGUNDOS, message: {...} } }`), aunque el BODY que uno manda para
 * enviar un mensaje sí es el formato nativo de la Cloud API. Sigue sin
 * probarse contra una llamada real (solo contra la documentación) — si algo
 * no coincide en producción, este es el único archivo que debería necesitar
 * ajustes.
 */

import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { WhatsAppMediaKind } from "@prisma/client";

const API_ROOT = "https://api.chakrahq.com";
const EXT_BASE = `${API_ROOT}/v1/ext`; // mensajería y plantillas
const API_VERSION = "v22.0"; // versión de la Cloud API que Chakra pasa a Meta
const REQUEST_TIMEOUT_MS = 15_000; // sin esto, un Chakra caído/lento cuelga la acción del usuario sin límite

export interface ChakraAccount {
  phoneNumberId: string;
  pluginId: string;
  accessToken: string;
}

export class ChakraApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ChakraApiError";
  }
}

async function chakraRequest<T>(
  fullUrl: string,
  init: { method?: string; body?: unknown; accessToken: string },
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(fullUrl, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${init.accessToken}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    throw new ChakraApiError(`No se pudo conectar con Chakra: ${err instanceof Error ? err.message : err}`, 0);
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new ChakraApiError(`Chakra respondió ${res.status}: ${detail.slice(0, 300)}`, res.status);
  }
  return res.json() as Promise<T>;
}

// --- Envío -------------------------------------------------------------

interface SendResult {
  waMessageId: string;
}

// Chakra envuelve la respuesta en `_data` en vez de devolver el shape nativo
// de Meta (`{ messages: [{ id }] }`).
interface ChakraSendResponse {
  _data: { whatsappMessageId: string };
}

/** Manda un mensaje de texto libre. Solo válido dentro de la ventana de 24hs. */
export async function sendSessionTextMessage(
  account: ChakraAccount,
  toE164: string,
  text: string,
): Promise<SendResult> {
  const res = await chakraRequest<ChakraSendResponse>(
    `${EXT_BASE}/plugin/whatsapp/${account.pluginId}/api/${API_VERSION}/${account.phoneNumberId}/messages`,
    {
      method: "POST",
      accessToken: account.accessToken,
      body: {
        messaging_product: "whatsapp",
        to: toE164.replace(/^\+/, ""),
        type: "text",
        text: { body: text },
      },
    },
  );
  return { waMessageId: res._data.whatsappMessageId };
}

/** Manda una plantilla aprobada — la única forma de retomar fuera de la ventana de 24hs. */
export async function sendTemplateMessage(
  account: ChakraAccount,
  toE164: string,
  template: { name: string; language: string },
  variables: string[],
): Promise<SendResult> {
  const res = await chakraRequest<ChakraSendResponse>(
    `${EXT_BASE}/plugin/whatsapp/${account.pluginId}/api/${API_VERSION}/${account.phoneNumberId}/messages`,
    {
      method: "POST",
      accessToken: account.accessToken,
      body: {
        messaging_product: "whatsapp",
        to: toE164.replace(/^\+/, ""),
        type: "template",
        template: {
          name: template.name,
          language: { policy: "deterministic", code: template.language },
          ...(variables.length > 0
            ? { components: [{ type: "body", parameters: variables.map((text) => ({ type: "text", text })) }] }
            : {}),
        },
      },
    },
  );
  return { waMessageId: res._data.whatsappMessageId };
}

// --- Plantillas ----------------------------------------------------------

export interface ChakraTemplate {
  externalId: string;
  name: string;
  language: string;
  status: string;
  bodyText: string;
  variableCount: number;
}

function countVariables(bodyText: string): number {
  const matches = bodyText.match(/\{\{\d+\}\}/g);
  return matches ? new Set(matches).size : 0;
}

/** Lista las plantillas cargadas en la WABA (aprobadas, pendientes y rechazadas). */
export async function listTemplates(
  account: { wabaId: string; pluginId: string; accessToken: string },
): Promise<ChakraTemplate[]> {
  const res = await chakraRequest<{
    data: { id: string; name: string; language: string; status: string; components: { type: string; text?: string }[] }[];
  }>(`${EXT_BASE}/plugin/whatsapp/api/${API_VERSION}/${account.wabaId}/message_templates`, {
    accessToken: account.accessToken,
  });
  return res.data.map((t) => {
    const body = t.components.find((c) => c.type === "BODY")?.text ?? "";
    return {
      externalId: t.id,
      name: t.name,
      language: t.language,
      status: t.status,
      bodyText: body,
      variableCount: countVariables(body),
    };
  });
}

// --- Media -----------------------------------------------------------------

const MEDIA_KIND_BY_TYPE: Record<string, WhatsAppMediaKind> = {
  image: "image",
  audio: "audio",
  video: "video",
  document: "document",
  sticker: "sticker",
};

/** Descarga los bytes de un adjunto entrante. Chakra resuelve en un solo paso.
 *  Ojo: esta ruta NO lleva el prefijo `/v1/ext` (a diferencia de mensajería/plantillas). */
export async function downloadMedia(
  account: ChakraAccount,
  mediaId: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const res = await fetch(`${API_ROOT}/v2/whatsapp/${API_VERSION}/media/${mediaId}/show`, {
    headers: { Authorization: `Bearer ${account.accessToken}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new ChakraApiError(`No se pudo descargar el adjunto (${res.status})`, res.status);
  }
  const mimeType = res.headers.get("content-type") ?? "application/octet-stream";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, mimeType };
}

// --- Webhook: verificación de firma + parseo --------------------------------

/**
 * Verifica la firma HMAC-SHA256 del webhook sobre el body crudo, con el
 * secreto de equipo (Chakra → Admin → Team → Secrets). El header
 * `X-Chakra-Signature-256` NUNCA lleva el prefijo "sha256=" (a diferencia del
 * webhook nativo de Meta) — se tolera igual por robustez si algún día cambia.
 */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader) return false;
  const provided = signatureHeader.startsWith("sha256=") ? signatureHeader.slice(7) : signatureHeader;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const providedBuf = Buffer.from(provided, "hex");
  const expectedBuf = Buffer.from(expected, "hex");
  if (providedBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(providedBuf, expectedBuf);
}

export interface InboundMessageEvent {
  waMessageId: string;
  fromE164: string;
  timestamp: Date;
  contactName?: string;
  text?: string;
  media?: { mediaId: string; mimeType: string | null; kind: WhatsAppMediaKind };
}

interface ChakraInboundMessage {
  from: string;
  type: string;
  text?: { body: string };
  image?: { id: string; mime_type: string; caption?: string };
  audio?: { id: string; mime_type: string };
  video?: { id: string; mime_type: string; caption?: string };
  document?: { id: string; mime_type: string; caption?: string };
  sticker?: { id: string; mime_type: string };
}

interface ChakraWebhookPayload {
  event: string;
  payload?: {
    messageId: string;
    timestamp: number; // milisegundos, no segundos
    message: ChakraInboundMessage;
    contacts?: { profile?: { name?: string } }[];
  };
}

/**
 * Normaliza un evento del webhook de Chakra (su propio formato, NO el
 * pass-through de Meta) a una lista de mensajes entrantes. Devuelve `[]` para
 * cualquier evento que no sea `event:"message"` (status de entrega,
 * facturación, etc.) — fuera de alcance del inbox, se ignoran sin romper el
 * webhook. Cada request de Chakra trae UN evento, no un batch — el array de
 * salida es por compatibilidad con el llamador, nunca tiene más de 1 elemento.
 */
export function parseInboundEvent(raw: unknown): InboundMessageEvent[] {
  const event = raw as ChakraWebhookPayload | null;
  if (!event || event.event !== "message" || !event.payload?.message) return [];

  const { payload } = event;
  const m = payload.message;
  const base = {
    waMessageId: payload.messageId,
    fromE164: `+${m.from}`,
    timestamp: new Date(payload.timestamp),
    contactName: payload.contacts?.[0]?.profile?.name,
  };

  if (m.type === "text" && m.text) {
    return [{ ...base, text: m.text.body }];
  }
  const mediaField = m.image ?? m.audio ?? m.video ?? m.document ?? m.sticker;
  if (mediaField && m.type in MEDIA_KIND_BY_TYPE) {
    return [
      {
        ...base,
        text: (mediaField as { caption?: string }).caption,
        media: { mediaId: mediaField.id, mimeType: mediaField.mime_type ?? null, kind: MEDIA_KIND_BY_TYPE[m.type] },
      },
    ];
  }
  // Otros tipos (location, contacts, button, interactive, reaction, unsupported) se ignoran a propósito.
  return [];
}
