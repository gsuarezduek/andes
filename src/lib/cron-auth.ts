import "server-only";
import type { NextRequest } from "next/server";

function bearer(req: NextRequest): string | null {
  const h = req.headers.get("authorization");
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1] : null;
}

/** Comparación de tiempo constante para no filtrar el secreto por timing. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * ¿El request trae el secreto de cron correcto? (header `Authorization:
 * Bearer <secret>` o `X-Cron-Secret: <secret>`). Compartido entre los
 * endpoints que el cron de Railway llama sin sesión (/api/sync,
 * /api/daily-summary).
 */
export function isValidCronRequest(req: NextRequest, secret: string): boolean {
  const provided = bearer(req) ?? req.headers.get("x-cron-secret");
  return provided != null && timingSafeEqual(provided, secret);
}
