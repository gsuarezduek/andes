/**
 * Disponibilidad de autos para el bot de WhatsApp: rango de fechas + auto
 * puntual opcional. Lógica de fechas/solapamiento separada de la query a DB
 * (`checkAvailability`) para poder testearla sin Prisma — mismo patrón que
 * `computeRentalPayments`/`serviceOverdueSeverity`.
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import { formatDateInput, mendozaWallTimeToUtc } from "@/lib/datetime";
import { vehicleDisplayName } from "@/lib/vehicle-ui";

/** Como máximo, cuántos días de rango puede pedir una consulta. */
export const MAX_AVAILABILITY_RANGE_DAYS = 60;
/** Como máximo, cuánto hacia adelante puede empezar el rango consultado. */
export const MAX_AVAILABILITY_HORIZON_DAYS = 180;
const DAY_MS = 24 * 60 * 60 * 1000;

export type AvailabilityRange = { startUtc: Date; endUtc: Date };
export type AvailabilityRangeResult = { ok: true; range: AvailabilityRange } | { ok: false; error: string };

/**
 * Valida y convierte un rango "YYYY-MM-DD".."YYYY-MM-DD" (hora de pared
 * Mendoza) a instantes UTC. `now` se recibe explícito para poder testear sin
 * depender del reloj real.
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseAvailabilityRange(startDate: string, endDate: string, now: Date): AvailabilityRangeResult {
  if (!ISO_DATE.test(startDate) || !ISO_DATE.test(endDate)) {
    return { ok: false, error: "Fechas inválidas. Usá el formato YYYY-MM-DD." };
  }
  const startUtc = mendozaWallTimeToUtc(`${startDate}T00:00`);
  const endUtc = mendozaWallTimeToUtc(`${endDate}T23:59`);
  if (Number.isNaN(startUtc.getTime()) || Number.isNaN(endUtc.getTime())) {
    return { ok: false, error: "Fechas inválidas. Usá el formato YYYY-MM-DD." };
  }
  if (endUtc <= startUtc) {
    return { ok: false, error: "La fecha de devolución tiene que ser posterior a la de retiro." };
  }
  const todayStart = mendozaWallTimeToUtc(`${formatDateInput(now)}T00:00`);
  if (startUtc < todayStart) {
    return { ok: false, error: "La fecha de retiro no puede ser en el pasado." };
  }
  const horizonEnd = new Date(todayStart.getTime() + MAX_AVAILABILITY_HORIZON_DAYS * DAY_MS);
  if (startUtc > horizonEnd) {
    return { ok: false, error: `Como máximo puedo consultar hasta ${MAX_AVAILABILITY_HORIZON_DAYS} días hacia adelante.` };
  }
  const rangeDays = Math.round((endUtc.getTime() - startUtc.getTime()) / DAY_MS);
  if (rangeDays > MAX_AVAILABILITY_RANGE_DAYS) {
    return { ok: false, error: `Como máximo puedo consultar un rango de ${MAX_AVAILABILITY_RANGE_DAYS} días.` };
  }
  return { ok: true, range: { startUtc, endUtc } };
}

export type AvailabilityVehicle = {
  id: string;
  brand: string;
  model: string;
  name: string | null;
  dailyRate: number | null;
};

export type BlockingRental = { vehicleId: string | null; startAt: Date; endAt: Date };

/**
 * Filtra el catálogo contra las reservas que bloquean cada auto — pura,
 * testeada. Un auto queda ocupado si alguna reserva se solapa con el rango
 * ([startAt, endAt) contra [start, end)).
 */
export function filterAvailableVehicles(
  vehicles: AvailabilityVehicle[],
  blockingRentals: BlockingRental[],
  range: AvailabilityRange,
): AvailabilityVehicle[] {
  const blockedIds = new Set(
    blockingRentals
      .filter((r) => r.vehicleId && r.startAt < range.endUtc && r.endAt > range.startUtc)
      .map((r) => r.vehicleId as string),
  );
  return vehicles.filter((v) => !blockedIds.has(v.id));
}

/** Estados de reserva que bloquean el auto (incluye el placeholder de service). */
const BLOCKING_STATUSES = ["reserved", "active", "out_of_service"] as const;

const MAX_AVAILABILITY_RESULTS = 8;

export type AvailabilityToolResult =
  | { ok: true; available: { label: string; dailyRate: number | null }[]; truncated: boolean }
  | { ok: false; error: string };

/**
 * Tool de disponibilidad del bot: catálogo activo (no archivado, no en
 * service) que no se solapa con ninguna reserva en el rango pedido.
 * `vehicleQuery` filtra por marca/modelo/apodo si el cliente pidió algo
 * puntual. Sin patente en la respuesta a propósito — es un chat, no hace
 * falta identificar la unidad física exacta antes de reservar.
 */
export async function checkAvailability(input: {
  startDate: string;
  endDate: string;
  vehicleQuery?: string;
}): Promise<AvailabilityToolResult> {
  const parsed = parseAvailabilityRange(input.startDate, input.endDate, new Date());
  if (!parsed.ok) return parsed;

  const query = input.vehicleQuery?.trim();
  const vehicles = await prisma.vehicle.findMany({
    where: {
      archivedAt: null,
      status: { not: "out_of_service" },
      ...(query
        ? {
            OR: [
              { brand: { contains: query, mode: "insensitive" } },
              { model: { contains: query, mode: "insensitive" } },
              { name: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: { id: true, brand: true, model: true, name: true, dailyRate: true },
  });
  if (vehicles.length === 0) return { ok: true, available: [], truncated: false };

  const rentals = await prisma.rental.findMany({
    where: { vehicleId: { in: vehicles.map((v) => v.id) }, status: { in: [...BLOCKING_STATUSES] } },
    select: { vehicleId: true, startAt: true, endAt: true },
  });

  const available = filterAvailableVehicles(
    vehicles.map((v) => ({ ...v, dailyRate: v.dailyRate != null ? Number(v.dailyRate) : null })),
    rentals,
    parsed.range,
  ).sort((a, b) => (a.dailyRate ?? Infinity) - (b.dailyRate ?? Infinity));

  return {
    ok: true,
    available: available.slice(0, MAX_AVAILABILITY_RESULTS).map((v) => ({ label: vehicleDisplayName(v), dailyRate: v.dailyRate })),
    truncated: available.length > MAX_AVAILABILITY_RESULTS,
  };
}
