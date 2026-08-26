import "server-only";
import { prisma } from "@/lib/prisma";
import type { BookingSource, RawCar, RawSeason } from "./types";
import { createBookingSource } from "./source";
import { computeDailyRate } from "./rates";

/**
 * Refresca la tarifa por día (referencia, 1 día) de cada modelo desde VikRentCar:
 * base de `dispcost` × ajuste de la temporada vigente hoy. Actualiza todas las
 * unidades (`vehicles`) con ese `wpCarId`. Solo actualiza (no crea) y solo cuando
 * el modelo tiene tarifa base cargada. Se corre en cada `runBookingSync`.
 *
 * Además persiste las temporadas crudas en `SeasonRate` (se borran y se
 * recrean enteras en cada corrida — no hay id propio del lado de WP para
 * upsert, y es una tabla chica). Antes se calculaban y se descartaban; ahora
 * el Calendario las usa para marcar los días con un incremento vigente.
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

  await prisma.$transaction([
    prisma.seasonRate.deleteMany({}),
    ...(seasons.length > 0
      ? [
          prisma.seasonRate.createMany({
            data: seasons.map((s) => ({
              fromSeconds: s.from,
              toSeconds: s.to,
              year: s.year,
              diffPercent: s.diffPercent,
              carIds: s.idcars,
            })),
          }),
        ]
      : []),
  ]);

  return { updated, models: cars.length };
}
