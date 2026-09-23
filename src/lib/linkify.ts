/**
 * Detecta URLs sueltas en un texto de WhatsApp (el mensaje llega como texto
 * plano, sin markup) y las separa en segmentos para poder renderizarlas como
 * link — WhatsApp mismo no manda esto armado. Un link sin protocolo
 * (`www.algo.com`) se acepta para detectar, pero el `href` siempre lleva
 * `https://` adelante (si no, el navegador lo trata como ruta relativa).
 */
const URL_PATTERN = /(https?:\/\/[^\s<>"')\]]+|www\.[^\s<>"')\]]+)/gi;

// Puntuación de cierre que WhatsApp no manda como parte del link (paréntesis,
// punto final de la oración, coma) — si el link matcheado termina en uno de
// estos caracteres, se lo devuelve al texto en vez de incluirlo en el href.
const TRAILING_PUNCTUATION = /[).,;:!?]+$/;

export type TextSegment = { type: "text"; text: string };
export type LinkSegment = { type: "link"; href: string; label: string };
export type MessageSegment = TextSegment | LinkSegment;

/** Recorta una URL larga a `maxLength` para mostrar, sin tocar el href real. */
export function shortenUrlLabel(url: string, maxLength = 42): string {
  let label = url;
  try {
    const withProtocol = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const parsed = new URL(withProtocol);
    label = parsed.hostname.replace(/^www\./, "") + parsed.pathname + parsed.search;
    label = label.replace(/\/$/, "");
  } catch {
    // URL inválida para el parser nativo (raro, pero no debería romper el render) — se recorta el texto crudo.
  }
  if (label.length <= maxLength) return label;
  return `${label.slice(0, maxLength - 1)}…`;
}

/** Separa un texto en segmentos de texto plano y links, para renderizar cada uno distinto. */
export function linkifyText(text: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const index = match.index ?? 0;
    let raw = match[0];
    let trailing = "";
    const trailingMatch = raw.match(TRAILING_PUNCTUATION);
    if (trailingMatch) {
      trailing = trailingMatch[0];
      raw = raw.slice(0, raw.length - trailing.length);
    }

    if (index > lastIndex) {
      segments.push({ type: "text", text: text.slice(lastIndex, index) });
    }
    const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    segments.push({ type: "link", href, label: shortenUrlLabel(raw) });
    lastIndex = index + raw.length;
    if (trailing) {
      segments.push({ type: "text", text: trailing });
      lastIndex += trailing.length;
    }
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", text: text.slice(lastIndex) });
  }
  return segments;
}
