/**
 * Adaptador hacia Chakra (chakrahq.com), el BSP (Business Solution Provider)
 * que actúa de intermediario hacia la WhatsApp Cloud API de Meta. El cuerpo
 * de los requests de mensajería es el formato NATIVO de la Cloud API — Chakra
 * es transparente ahí; solo cambia la URL base y cómo se resuelve/descarga
 * media.
 *
 * ⚠️ Base URL, rutas exactas y esquema de autenticación están tomados de una
 * integración hermana (mismo proveedor, otro proyecto) pero NO están
 * verificados contra una cuenta real de Chakra todavía — mismo criterio que
 * "Fase 0" con VikRentCar: verificar contra el dashboard/docs de Chakra antes
 * de dar por buena la integración en producción, y ajustar acá si algo no
 * coincide (es el único archivo que necesita tocarse).
 */

import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { WhatsAppMediaKind } from "@prisma/client";

const BASE_URL = "https://api.chakrahq.com";
const API_VERSION = "v20.0"; // versión de la Cloud API que Chakra pasa a Meta
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
  path: string,
  init: { method?: string; body?: unknown; accessToken: string },
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
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

/** Manda un mensaje de texto libre. Solo válido dentro de la ventana de 24hs. */
export async function sendSessionTextMessage(
  account: ChakraAccount,
  toE164: string,
  text: string,
): Promise<SendResult> {
  const res = await chakraRequest<{ messages: { id: string }[] }>(
    `/plugin/whatsapp/${account.pluginId}/api/${API_VERSION}/${account.phoneNumberId}/messages`,
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
  return { waMessageId: res.messages[0].id };
}

/** Manda una plantilla aprobada — la única forma de retomar fuera de la ventana de 24hs. */
export async function sendTemplateMessage(
  account: ChakraAccount,
  toE164: string,
  template: { name: string; language: string },
  variables: string[],
): Promise<SendResult> {
  const res = await chakraRequest<{ messages: { id: string }[] }>(
    `/plugin/whatsapp/${account.pluginId}/api/${API_VERSION}/${account.phoneNumberId}/messages`,
    {
      method: "POST",
      accessToken: account.accessToken,
      body: {
        messaging_product: "whatsapp",
        to: toE164.replace(/^\+/, ""),
        type: "template",
        template: {
          name: template.name,
          language: { code: template.language },
          ...(variables.length > 0
            ? { components: [{ type: "body", parameters: variables.map((text) => ({ type: "text", text })) }] }
            : {}),
        },
      },
    },
  );
  return { waMessageId: res.messages[0].id };
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
  }>(`/plugin/whatsapp/api/${API_VERSION}/${account.wabaId}/message_templates`, {
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

/** Descarga los bytes de un adjunto entrante. Chakra resuelve en un solo paso. */
export async function downloadMedia(
  account: ChakraAccount,
  mediaId: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const res = await fetch(`${BASE_URL}/v2/whatsapp/${API_VERSION}/media/${mediaId}/show`, {
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
 * Verifica la firma HMAC-SHA256 del webhook sobre el body crudo. Chakra manda
 * el header `X-Chakra-Signature-256` sin el prefijo "sha256=" que sí usa el
 * webhook nativo de Meta — se tolera con o sin prefijo por robustez.
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

interface MetaMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: { id: string; mime_type: string; caption?: string };
  audio?: { id: string; mime_type: string };
  video?: { id: string; mime_type: string; caption?: string };
  document?: { id: string; mime_type: string; caption?: string };
  sticker?: { id: string; mime_type: string };
}

/**
 * Normaliza el payload crudo del webhook (formato nativo de la Cloud API,
 * pass-through de Chakra) a una lista de mensajes entrantes. Devuelve `[]`
 * para cualquier otro tipo de evento (status de entrega, reacciones, etc.) —
 * fuera de alcance del inbox por ahora, se ignoran sin romper el webhook.
 */
export function parseInboundEvent(payload: unknown): InboundMessageEvent[] {
  const events: InboundMessageEvent[] = [];
  const entries = (payload as { entry?: unknown[] })?.entry;
  if (!Array.isArray(entries)) return events;

  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const value = (change as { value?: { messages?: MetaMessage[]; contacts?: { profile?: { name?: string }; wa_id?: string }[] } })
        ?.value;
      const messages = value?.messages;
      if (!Array.isArray(messages)) continue;
      const contactName = value?.contacts?.[0]?.profile?.name;

      for (const m of messages) {
        const base = {
          waMessageId: m.id,
          fromE164: `+${m.from}`,
          timestamp: new Date(Number(m.timestamp) * 1000),
          contactName,
        };
        const mediaField = m.image ?? m.audio ?? m.video ?? m.document ?? m.sticker;
        if (m.type === "text" && m.text) {
          events.push({ ...base, text: m.text.body });
        } else if (mediaField && m.type in MEDIA_KIND_BY_TYPE) {
          events.push({
            ...base,
            text: (mediaField as { caption?: string }).caption,
            media: { mediaId: mediaField.id, mimeType: mediaField.mime_type ?? null, kind: MEDIA_KIND_BY_TYPE[m.type] },
          });
        }
        // Otros tipos (location, contacts, button, interactive, reaction, unsupported) se ignoran a propósito.
      }
    }
  }
  return events;
}
