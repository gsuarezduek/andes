import "server-only";
import { prisma } from "@/lib/prisma";
import { formatDateInput, mendozaWallTimeToUtc } from "@/lib/datetime";
import type { PriceCheckWindow } from "./types";

export const DEFAULT_OFFSETS_DAYS = [0, 30, 60];
export const DEFAULT_RENTAL_DURATION_DAYS = 3;

export type CompetitorPriceSettingsValue = {
  offsetsDays: number[];
  rentalDurationDays: number;
};

/** Lee el singleton (id=1); si no existe todavía, devuelve los defaults sin crear la fila. */
export async function getCompetitorPriceSettings(): Promise<CompetitorPriceSettingsValue> {
  const row = await prisma.competitorPriceSettings.findUnique({ where: { id: 1 } });
  return {
    offsetsDays: row?.offsetsDays?.length ? row.offsetsDays : DEFAULT_OFFSETS_DAYS,
    rentalDurationDays: row?.rentalDurationDays ?? DEFAULT_RENTAL_DURATION_DAYS,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Traduce offsets (días desde "hoy", ej. [0,30,60]) a ventanas de fecha
 * concretas en hora de Mendoza. Pura y testeable — separada de
 * `getCompetitorPriceSettings` (que además pega a la DB).
 */
export function resolveOffsetsToWindows(
  offsetsDays: number[],
  rentalDurationDays: number,
  now: Date,
): PriceCheckWindow[] {
  const todayKey = formatDateInput(now);
  const todayMidnight = mendozaWallTimeToUtc(`${todayKey}T00:00`);
  return offsetsDays.map((offsetDays) => {
    const pickupDate = new Date(todayMidnight.getTime() + offsetDays * DAY_MS);
    const returnDate = new Date(pickupDate.getTime() + rentalDurationDays * DAY_MS);
    return { pickupDate, returnDate, days: rentalDurationDays, offsetDays };
  });
}
