import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { isValidCronRequest } from "@/lib/cron-auth";
import { sendDailySummaryEmail } from "@/lib/daily-summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Manda el resumen diario de alertas vencidas (devoluciones + service) al
 * admin por email. Pensado para un cron diario de Railway (mismo criterio
 * que /api/sync): autenticación por CRON_SECRET, NO por sesión — este
 * endpoint está excluido del proxy de auth (ver src/proxy.ts). Sin alertas
 * vencidas, no manda nada (`sent: false`).
 *
 *   curl -X POST https://andes.mdzrentacar.com/api/daily-summary \
 *        -H "Authorization: Bearer $CRON_SECRET"
 */
export async function POST(req: NextRequest) {
  if (!env.hasCronSecret) {
    return NextResponse.json({ error: "CRON_SECRET no configurado" }, { status: 503 });
  }
  if (!isValidCronRequest(req, env.cronSecret)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  const result = await sendDailySummaryEmail();
  return NextResponse.json(result);
}
