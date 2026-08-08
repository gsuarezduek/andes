import "server-only";
import { headers } from "next/headers";

// En memoria, por proceso: alcanza para un solo dyno (Railway) y para
// limitar abuso básico (spam de emails, fuerza bruta) sin infraestructura
// nueva. No sobrevive un restart ni escala a múltiples instancias — si algún
// día hay más de un dyno, esto necesita un store compartido (Redis).
const buckets = new Map<string, number[]>();

/** True si `key` superó `max` intentos en los últimos `windowMs` ms. */
export function isRateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const times = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  times.push(now);
  buckets.set(key, times);
  return times.length > max;
}

/** IP del cliente detrás del proxy de Railway (o "unknown" si no viene el header). */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
