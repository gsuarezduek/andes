import "server-only";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { vikRentCarUnixToUtc } from "@/lib/datetime";
import { resolveLocale } from "@/lib/i18n/config";
import type { BookingSource, RawBooking, RawCar, RawOptional, RawSeason } from "./types";
import { createBookingSource } from "./source";
import { computeDailyRate } from "./rates";
import { resolveOptionals } from "./optionals";

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

export type SyncSummary = {
  result: "success" | "partial" | "error";
  imported: number;
  updated: number;
  cancelled: number;
  skipped: number;
  errors: number;
  message: string;
};

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

type Outcome = "imported" | "updated" | "cancelled" | "skipped";

async function upsertBooking(b: RawBooking, optionals: RawOptional[] = []): Promise<Outcome> {
  const existing = await prisma.rental.findUnique({
    where: { wpBookingId: b.wpBookingId },
    include: { inspections: { select: { id: true }, take: 1 } },
  });
  const hasInspection = (existing?.inspections.length ?? 0) > 0;

  // Cancelación: solo si aún no hay entrega registrada (inmutabilidad).
  if (b.status === "cancelled") {
    if (!existing) return "skipped";
    if (hasInspection || existing.status === "cancelled") return "skipped";
    await prisma.rental.update({
      where: { id: existing.id },
      data: { status: "cancelled" },
    });
    return "cancelled";
  }

  // Solo importamos confirmadas (y standby si está habilitado).
  if (b.status !== "confirmed" && !(b.status === "standby" && env.sync.includeStandby)) {
    return "skipped";
  }

  const vehicleId = await resolveVehicleId(b.idcar, b.carindex);
  const language = resolveLocale(b.lang);
  const startAt = vikRentCarUnixToUtc(b.startUnix);
  const endAt = vikRentCarUnixToUtc(b.endUnix);
  const booking = bookingFacts(b, optionals);

  if (!existing) {
    await prisma.rental.create({
      data: {
        origin: "vikrentcar",
        wpBookingId: b.wpBookingId,
        status: "reserved",
        vehicleId,
        language,
        startAt,
        endAt,
        clientName: b.clientName,
        clientEmail: b.clientEmail,
        clientPhone: b.clientPhone,
        clientDocNumber: b.clientDocNumber,
        clientCountry: b.clientCountry,
        ...booking,
      },
    });
    return "imported";
  }

  // No tocamos reservas que ya arrancaron el flujo físico (entrega/devolución)
  // ni las que el empleado cerró: la orden de VikRentCar deja de ser la verdad.
  if (hasInspection || existing.status !== "reserved") return "skipped";

  await prisma.rental.update({
    where: { id: existing.id },
    data: {
      vehicleId,
      language,
      startAt,
      endAt,
      clientName: b.clientName,
      clientEmail: b.clientEmail,
      clientPhone: b.clientPhone,
      clientDocNumber: b.clientDocNumber,
      ...booking,
    },
  });
  return "updated";
}

/**
 * Datos económicos de la orden (referencia para precargar/confirmar las
 * condiciones). NO son pricing del contrato: eso lo carga el empleado y el sync
 * nunca lo pisa. Ver docs/wordpress-mapping.md.
 */
function bookingFacts(b: RawBooking, optionals: RawOptional[] = []) {
  const perDay =
    b.carCost != null && b.days && b.days > 0
      ? Math.round((b.carCost / b.days) * 100) / 100
      : null;
  // Opcionales: packs de km → accesorios (desc + importe), mejora de seguro → flag.
  const opt = resolveOptionals(b.optionals, optionals, b.days);
  return {
    // `standby` entra sin confirmar (naranja); `confirmed` confirmada. Si el dueño
    // confirma en VikRentCar, el próximo sync la actualiza a true.
    bookingConfirmed: b.status === "confirmed",
    bookingDays: b.days,
    bookingTotal: b.orderTotal,
    bookingPaid: b.paid,
    bookingNote: b.custData,
    bookingPricePerDay: perDay,
    bookingModel: b.carName,
    bookingPickupPlace: b.pickupPlace,
    bookingReturnPlace: b.returnPlace,
    bookingAccessories: opt.accessoriesDesc,
    bookingAccessoriesAmount: opt.accessoriesAmount,
    bookingInsuranceUpgrade: opt.insuranceUpgrade,
  };
}

/** Mapea (idcar, carindex) → vehicle.id. `carindex` NULL → sin unidad asignada. */
async function resolveVehicleId(
  idcar: number | null,
  carindex: number | null,
): Promise<string | null> {
  if (idcar == null || carindex == null) return null;
  const v = await prisma.vehicle.findUnique({
    where: { wpCarId_wpCarIndex: { wpCarId: idcar, wpCarIndex: carindex } },
    select: { id: true },
  });
  return v?.id ?? null;
}

/**
 * Refresca la tarifa por día (referencia, 1 día) de cada modelo desde VikRentCar:
 * base de `dispcost` × ajuste de la temporada vigente hoy. Actualiza todas las
 * unidades (`vehicles`) con ese `wpCarId`. Solo actualiza (no crea) y solo cuando
 * el modelo tiene tarifa base cargada. Se corre en cada `runBookingSync`.
 */
export async function syncCarRates(
  source?: BookingSource,
): Promise<{ updated: number; models: number }> {
  const src = source ?? createBookingSource();
  let cars: RawCar[];
  let seasons: RawSeason[];
  try {
    [cars, seasons] = await Promise.all([src.fetchCars(), src.fetchSeasons()]);
  } finally {
    // Solo cerramos si creamos la fuente acá (si viene de runBookingSync, la
    // cierra el llamador).
    if (!source) await src.close?.();
  }

  const now = new Date();
  let updated = 0;
  for (const car of cars) {
    const rate = computeDailyRate(car.baseDailyRate, seasons, car.id, now);
    if (rate == null) continue;
    const res = await prisma.vehicle.updateMany({
      where: { wpCarId: car.id },
      data: { dailyRate: rate, dailyRateUpdatedAt: now },
    });
    updated += res.count;
  }
  return { updated, models: cars.length };
}

/**
 * Seed inicial de la flota desde `wp_vikrentcar_cars`. Crea las unidades que
 * falten (par wp_car_id/wp_car_index) con patente placeholder; **nunca pisa**
 * un vehículo ya cargado. Se corre a demanda, no en cada sync.
 */
export async function seedFleetFromWp(
  source?: BookingSource,
): Promise<{ created: number; existing: number; models: number }> {
  const src = source ?? createBookingSource();
  let cars: RawCar[];
  try {
    cars = await src.fetchCars();
  } finally {
    await src.close?.();
  }

  let created = 0;
  let existing = 0;
  for (const car of cars) {
    const { brand, model } = splitName(car.name);
    for (let index = 1; index <= car.units; index++) {
      const found = await prisma.vehicle.findUnique({
        where: { wpCarId_wpCarIndex: { wpCarId: car.id, wpCarIndex: index } },
        select: { id: true },
      });
      if (found) {
        existing++;
        continue;
      }
      await prisma.vehicle.create({
        data: {
          plate: `TEMP-${car.id}-${index}`,
          brand,
          model,
          wpCarId: car.id,
          wpCarIndex: index,
        },
      });
      created++;
    }
  }
  return { created, existing, models: cars.length };
}

function splitName(name: string): { brand: string; model: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return { brand: name.trim() || "—", model: name.trim() || "—" };
  return { brand: parts[0], model: parts.slice(1).join(" ") };
}

async function recordLog(
  result: SyncSummary["result"],
  imported: number,
  updated: number,
  errors: number,
  message: string,
): Promise<void> {
  await prisma.syncLog.create({
    data: { result, imported, updated, errors, message: message.slice(0, 1000) },
  });
}

function buildMessage(s: {
  total: number;
  imported: number;
  updated: number;
  cancelled: number;
  skipped: number;
  errors: number;
  problems: string[];
}): string {
  const base = `${s.total} órdenes en ventana · nuevas ${s.imported} · actualizadas ${s.updated} · canceladas ${s.cancelled} · sin cambios ${s.skipped} · errores ${s.errors}`;
  if (s.problems.length === 0) return base;
  return `${base}\n${s.problems.slice(0, 10).join("\n")}`;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
