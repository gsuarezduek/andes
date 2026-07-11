import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { runBookingSync } from "@/lib/sync/engine";

export const runtime = "nodejs";
// El sync puede tardar unos segundos; no lo cachees.
export const dynamic = "force-dynamic";

/**
 * Dispara la sincronización con VikRentCar. Pensado para el cron de Railway.
 * Autenticación por secreto compartido (CRON_SECRET), NO por sesión — este
 * endpoint está excluido del proxy de auth (ver src/proxy.ts).
 *
 *   curl -X POST https://andes.mdzrentacar.com/api/sync \
 *        -H "Authorization: Bearer $CRON_SECRET"
 */
export async function POST(req: NextRequest) {
  if (!env.hasCronSecret) {
    return NextResponse.json({ error: "CRON_SECRET no configurado" }, { status: 503 });
  }
  const provided = bearer(req) ?? req.headers.get("x-cron-secret");
  if (!provided || !timingSafeEqual(provided, env.cronSecret)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  const summary = await runBookingSync();
  const status = summary.result === "error" ? 502 : 200;
  return NextResponse.json(summary, { status });
}

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
