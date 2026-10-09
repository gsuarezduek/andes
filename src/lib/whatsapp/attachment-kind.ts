/**
 * Clasificación pura de un adjunto que el equipo manda por WhatsApp — sin
 * `server-only` a propósito: la usa tanto el servidor (para armar el mensaje
 * hacia la Cloud API) como el compositor en el cliente (para elegir el ícono
 * de la vista previa antes de enviar, sin ir al servidor).
 *
 * La Cloud API de WhatsApp solo acepta tipos puntuales como "image"/"video"
 * (`image/jpeg`, `image/png`; `video/mp4`, `video/3gpp`) — cualquier otra
 * cosa (webp, gif, zip, docx, xlsx, …) se manda como "document", que acepta
 * un rango mucho más amplio. Clasificar mal como image/video haría que Meta
 * rechace el envío.
 */

export type OutboundAttachmentWaType = "image" | "video" | "document";
export type OutboundAttachmentKind = OutboundAttachmentWaType; // mismo valor que WhatsAppMediaKind para estos tres

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png"]);
const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/3gpp"]);

export function classifyOutboundAttachment(mimeType: string): { waType: OutboundAttachmentWaType; kind: OutboundAttachmentKind } {
  if (IMAGE_MIME_TYPES.has(mimeType)) return { waType: "image", kind: "image" };
  if (VIDEO_MIME_TYPES.has(mimeType)) return { waType: "video", kind: "video" };
  return { waType: "document", kind: "document" };
}

/** Para mostrar algo razonable en la vista previa antes de enviar. */
export function attachmentIcon(mimeType: string): string {
  const { waType } = classifyOutboundAttachment(mimeType);
  if (waType === "image") return "🖼️";
  if (waType === "video") return "🎞️";
  if (mimeType === "application/pdf") return "📄";
  return "📎";
}

/** "1.2 MB" / "340 KB" — mismo criterio de redondeo que el resto de la app. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Content-Type real por los primeros bytes — nunca el que declara el
 * navegador (`file.type`), que cualquiera puede falsificar (mismo criterio
 * que `/api/uploads`, ver `sniffContentType` ahí; duplicado a propósito acá
 * en vez de importar ese route handler, que es específico del wizard de
 * inspección). `null` si no matchea ningún formato conocido — ahí se cae al
 * tipo declarado por el navegador (ver `whatsapp/actions.ts`), Meta termina
 * validando del lado de ellos de todas formas.
 */
export function sniffBinaryType(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) {
    return "image/png";
  }
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  if (buffer.length >= 4 && buffer.toString("ascii", 0, 4) === "%PDF") return "application/pdf";
  return null;
}
