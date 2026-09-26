import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { runBookingSync } from "@/lib/sync/engine";
import { runRoomSync, type RoomSyncSummary } from "@/lib/rooms/sync";
import { isValidCronRequest } from "@/lib/cron-auth";

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
  if (!isValidCronRequest(req, env.cronSecret)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  const summary = await runBookingSync();
  // Calendarios iCal de las habitaciones (Airbnb/Booking): mismo cron, sin
  // infraestructura extra. Best-effort — un fallo acá no cambia el resultado
  // (ni el status HTTP) del sync de VikRentCar.
  let rooms: RoomSyncSummary | { error: string } | null = null;
  try {
    rooms = await runRoomSync();
  } catch (e) {
    rooms = { error: e instanceof Error ? e.message : String(e) };
  }
  const status = summary.result === "error" ? 502 : 200;
  return NextResponse.json({ ...summary, rooms }, { status });
}
