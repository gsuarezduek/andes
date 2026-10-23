/**
 * Disponibilidad de autos para el bot de WhatsApp: rango de fechas + auto
 * puntual opcional. Lógica de fechas/solapamiento separada de la query a DB
 * (`checkAvailability`) para poder testearla sin Prisma — mismo patrón que
 * `computeRentalPayments`/`serviceOverdueSeverity`.
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import { formatDateInput, mendozaWallTimeToUtc } from "@/lib/datetime";
import { vehicleBrandModel } from "@/lib/vehicle-ui";
import { seasonsForDayAndCar, type SeasonRateRow } from "@/lib/calendar";
import { buildQuoteRange, estimateQuoteTotal, quoteDaysBreakdown, quotePricePerDay } from "@/lib/quote-estimate";

/** Como máximo, cuántos días de rango puede pedir una consulta. */
export const MAX_AVAILABILITY_RANGE_DAYS = 60;
/** Como máximo, cuánto hacia adelante puede empezar el rango consultado. */
export const MAX_AVAILABILITY_HORIZON_DAYS = 180;
/**
 * Ventana en la que la cotización del bot (tarifa base × temporadas de cada
 * día, ver `estimateBotQuote`) se considera un precio confirmado. Más allá,
 * puede haber una temporada/aumento todavía sin cargar en VikRentCar — no hay
 * que cotizar ese número como si fuera el precio real.
 */
export const MAX_PRICE_HORIZON_DAYS = 60;
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

/**
 * ¿La fecha de retiro cae dentro de la ventana de precio confirmado? Pura y
 * testeada aparte, mismo criterio que `parseAvailabilityRange` (recibe `now`
 * explícito en vez de leer el reloj real).
 */
export function isPriceConfirmedForDate(startUtc: Date, now: Date): boolean {
  const todayStart = mendozaWallTimeToUtc(`${formatDateInput(now)}T00:00`);
  const priceHorizonEnd = new Date(todayStart.getTime() + MAX_PRICE_HORIZON_DAYS * DAY_MS);
  return startUtc <= priceHorizonEnd;
}

export type AvailabilityVehicle = {
  id: string;
  brand: string;
  model: string;
  name: string | null;
  dailyRate: number | null;
  /** Modelo de VikRentCar — para saber qué temporadas le aplican. */
  wpCarId?: number | null;
};

/** Mismo horario por defecto que el presupuestador del Calendario
 *  (`DEFAULT_TIME` en quote-form-modal.tsx): retiro y devolución a la misma
 *  hora → se cobran las noches entre las dos fechas (mínimo 1 día). */
const BOT_QUOTE_TIME = "09:00";

export type BotQuote = {
  /** Total del rango, con la temporada de cada día aplicada. */
  total: number;
  /** Días que se cobran. */
  days: number;
  /** Promedio por día (total ÷ días). */
  pricePerDay: number | null;
  /** `true` si algún día cobrado tiene un aumento de temporada/fecha especial. */
  seasonalIncrease: boolean;
};

/**
 * Cotización del bot para un auto y un rango "YYYY-MM-DD" — **el mismo
 * cálculo que el presupuestador del Calendario** (`estimateQuoteTotal`):
 * reconstruye la tarifa base a partir de `dailyRate` (que ya trae la
 * temporada de HOY) y vuelve a aplicar, día por día, las temporadas vigentes
 * ese día para ese modelo. Pura (recibe `now` y las temporadas explícitas).
 * `null` si el auto no tiene tarifa.
 */
export function estimateBotQuote(input: {
  dailyRate: number | null;
  wpCarId: number | null;
  seasonRows: SeasonRateRow[];
  startDate: string;
  endDate: string;
  now: Date;
}): BotQuote | null {
  const { startAt, endAt } = buildQuoteRange(input.startDate, input.endDate, BOT_QUOTE_TIME, BOT_QUOTE_TIME);
  const breakdown = quoteDaysBreakdown(startAt, endAt);
  // Una entrada por día de calendario desde el retiro (igual que la grilla
  // del Calendario); `estimateQuoteTotal` cobra los primeros `breakdown.days`.
  const daySeasons = Array.from({ length: breakdown.days }, (_, i) =>
    seasonsForDayAndCar(input.seasonRows, new Date(startAt.getTime() + i * DAY_MS), input.wpCarId ?? null),
  );
  const todaySeasons = seasonsForDayAndCar(input.seasonRows, input.now, input.wpCarId ?? null);
  const estimate = estimateQuoteTotal(input.dailyRate, todaySeasons, daySeasons, breakdown, null);
  if (!estimate) return null;
  return {
    total: estimate.total,
    days: breakdown.days,
    pricePerDay: quotePricePerDay(estimate.total, breakdown.days),
    seasonalIncrease: daySeasons.some((d) => d.some((season) => season.diffPercent > 0)),
  };
}

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
  | {
      ok: true;
      /** `quote` null = sin precio (auto sin tarifa, o `priceConfirmed` false). */
      available: { label: string; quote: BotQuote | null }[];
      truncated: boolean;
      /**
       * `false` si la fecha de retiro queda más allá de `MAX_PRICE_HORIZON_DAYS`
       * — en ese caso `quote` viaja en `null` a propósito (puede haber una
       * temporada/aumento todavía sin confirmar en VikRentCar para esas
       * fechas). El prompt le indica al bot qué decir en ese caso.
       */
      priceConfirmed: boolean;
    }
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
  const now = new Date();
  const parsed = parseAvailabilityRange(input.startDate, input.endDate, now);
  if (!parsed.ok) return parsed;
  const priceConfirmed = isPriceConfirmedForDate(parsed.range.startUtc, now);

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
    select: { id: true, brand: true, model: true, name: true, dailyRate: true, wpCarId: true },
  });
  if (vehicles.length === 0) return { ok: true, available: [], truncated: false, priceConfirmed };

  const [rentals, seasonRates] = await Promise.all([
    prisma.rental.findMany({
      where: { vehicleId: { in: vehicles.map((v) => v.id) }, status: { in: [...BLOCKING_STATUSES] } },
      select: { vehicleId: true, startAt: true, endAt: true },
    }),
    prisma.seasonRate.findMany({
      select: { fromSeconds: true, toSeconds: true, year: true, diffPercent: true, carIds: true },
    }),
  ]);
  const seasonRows: SeasonRateRow[] = seasonRates.map((s) => ({ ...s, diffPercent: Number(s.diffPercent) }));

  const available = filterAvailableVehicles(
    vehicles.map((v) => ({ ...v, dailyRate: v.dailyRate != null ? Number(v.dailyRate) : null })),
    rentals,
    parsed.range,
  )
    .map((v) => ({
      vehicle: v,
      quote: priceConfirmed
        ? estimateBotQuote({
            dailyRate: v.dailyRate,
            wpCarId: v.wpCarId ?? null,
            seasonRows,
            startDate: input.startDate,
            endDate: input.endDate,
            now,
          })
        : null,
    }))
    .sort(
      (a, b) =>
        (a.quote?.total ?? a.vehicle.dailyRate ?? Infinity) - (b.quote?.total ?? b.vehicle.dailyRate ?? Infinity),
    );

  return {
    ok: true,
    available: available.slice(0, MAX_AVAILABILITY_RESULTS).map(({ vehicle, quote }) => ({
      label: vehicleBrandModel(vehicle),
      quote,
    })),
    truncated: available.length > MAX_AVAILABILITY_RESULTS,
    priceConfirmed,
  };
}
