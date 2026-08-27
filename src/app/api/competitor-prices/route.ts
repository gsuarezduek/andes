import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { runCompetitorPriceCheck } from "@/lib/competitor-prices/engine";
import { isValidCronRequest } from "@/lib/cron-auth";

export const runtime = "nodejs";
// La corrida puede tardar minutos (Chromium headless × varias combinaciones); no la cachees.
export const dynamic = "force-dynamic";

/**
 * Dispara la actualización de precios de la competencia. Pensado para el
 * cron de Railway (recomendado en horario de baja actividad — comparte
 * contenedor con el wizard de entrega/devolución). Autenticación por
 * secreto compartido (CRON_SECRET), NO por sesión — este endpoint está
 * excluido del proxy de auth (ver src/proxy.ts).
 *
 *   curl -X POST https://andes.mdzrentacar.com/api/competitor-prices \
 *        -H "Authorization: Bearer $CRON_SECRET"
 */
export async function POST(req: NextRequest) {
  if (!env.hasCronSecret) {
    return NextResponse.json({ error: "CRON_SECRET no configurado" }, { status: 503 });
  }
  if (!isValidCronRequest(req, env.cronSecret)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  const summary = await runCompetitorPriceCheck("cron");
  const status = summary.result === "error" ? 502 : 200;
  return NextResponse.json(summary, { status });
}
