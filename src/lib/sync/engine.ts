import "server-only";
import { env } from "@/lib/env";
import type { BookingSource, RawBooking, RawOptional } from "./types";
import { createBookingSource } from "./source";
import { upsertBooking } from "./booking-upsert";
import { syncCarRates } from "./car-rates";
import { recordLog, buildMessage, errMsg, type SyncSummary } from "./log";

export type { SyncSummary };

/**
 * Motor de sincronización VikRentCar → Andes (Fase 5).
 *
 * Estrategia (ver docs/wordpress-mapping.md §Reglas de sincronización):
 *  - Ventana móvil sobre `ritiro`/`consegna` (orders no tiene columna "modificado").
 *  - Importa `confirmed` como `reserved`. `cancelled` cancela el rental local
 *    **solo si aún no tiene inspección** (una entrega firmada es inmutable).
 *  - Mapea la unidad por par (idcar, carindex); `carindex` NULL → sin vehículo.
 *  - Nunca pisa datos cargados por el empleado (pricing, licencia, patente).
 *  - Registra cada corrida en `sync_logs`.
 */
export async function runBookingSync(source?: BookingSource): Promise<SyncSummary> {
  const src = source ?? createBookingSource();
  const now = Math.floor(Date.now() / 1000);
  const window = {
    fromUnix: now - env.sync.daysBack * 86_400,
    toUnix: now + env.sync.daysForward * 86_400,
    includeStandby: env.sync.includeStandby,
  };

  let imported = 0;
  let updated = 0;
  let cancelled = 0;
  let skipped = 0;
  let errors = 0;
  const problems: string[] = [];

  let bookings: RawBooking[];
  try {
    bookings = await src.fetchBookings(window);
  } catch (e) {
    await src.close?.();
    const message = `Fallo al leer reservas (${src.kind}): ${errMsg(e)}`;
    await recordLog("error", 0, 0, 1, message);
    return { result: "error", imported: 0, updated: 0, cancelled: 0, skipped: 0, errors: 1, message };
  }

  // Catálogo de opcionales (para resolver packs de km / mejora de seguro por
  // reserva). Best-effort: si falla, se importa sin opcionales.
  let optionals: RawOptional[] = [];
  try {
    optionals = await src.fetchOptionals();
  } catch {
    optionals = [];
  }

  try {
    for (const b of bookings) {
      try {
        const outcome = await upsertBooking(b, optionals);
        if (outcome === "imported") imported++;
        else if (outcome === "updated") updated++;
        else if (outcome === "cancelled") cancelled++;
        else skipped++;
      } catch (e) {
        errors++;
        problems.push(`orden #${b.wpBookingId}: ${errMsg(e)}`);
      }
    }
    // Refrescar la tarifa por día de cada modelo (best-effort: no debe tumbar el
    // sync de reservas). Reusa la misma conexión; no la cierra (lo hace el finally).
    try {
      await syncCarRates(src);
    } catch (e) {
      problems.push(`tarifas: ${errMsg(e)}`);
    }
  } finally {
    await src.close?.();
  }

  const result = errors === 0 ? "success" : imported + updated + cancelled > 0 ? "partial" : "error";
  const message = buildMessage({ total: bookings.length, imported, updated, cancelled, skipped, errors, problems });
  await recordLog(result, imported + cancelled, updated, errors, message);
  return { result, imported, updated, cancelled, skipped, errors, message };
}
