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
