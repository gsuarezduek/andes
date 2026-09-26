import type { RoomBookingSource } from "@prisma/client";

/** Procedencias que se pueden importar por iCal (no incluye `manual`). */
export const FEED_SOURCES = ["airbnb", "booking", "other"] as const satisfies readonly RoomBookingSource[];
export type FeedSource = (typeof FEED_SOURCES)[number];

export const roomSourceLabels: Record<RoomBookingSource, string> = {
  airbnb: "Airbnb",
  booking: "Booking",
  other: "Otro calendario",
  manual: "Directa",
};

/**
 * Valida el link de un feed iCal. El servidor lo consulta por su cuenta, así
 * que se exige https y se rechazan hosts internos (localhost, IPs privadas)
 * para que no se pueda usar el sync para pegarle a la red de adentro.
 */
export function validateFeedUrl(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  // Airbnb/Booking a veces lo muestran como webcal:// — es el mismo link por https.
  const normalized = raw.trim().replace(/^webcals?:\/\//i, "https://");
  let u: URL;
  try {
    u = new URL(normalized);
  } catch {
    return { ok: false, error: "El link no es una URL válida." };
  }
  if (u.protocol !== "https:") return { ok: false, error: "El link tiene que empezar con https://" };
  const host = u.hostname.toLowerCase();
  const isPrivateIp =
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === "::1" ||
    host.startsWith("[");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || isPrivateIp) {
    return { ok: false, error: "Ese link apunta a una dirección interna." };
  }
  return { ok: true, url: u.toString() };
}
