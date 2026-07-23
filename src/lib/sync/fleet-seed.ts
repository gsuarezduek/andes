import "server-only";
import { prisma } from "@/lib/prisma";
import type { BookingSource, RawCar } from "./types";
import { createBookingSource } from "./source";

/**
 * Seed inicial de la flota desde `wp_vikrentcar_cars`. Crea las unidades que
 * falten (par wp_car_id/wp_car_index) con patente placeholder; **nunca pisa**
 * un vehículo ya cargado. Se corre a demanda, no en cada sync.
 *
 * También **reactiva** automáticamente las unidades archivadas de un modelo
 * cuyo `avail` volvió a estar activo en VikRentCar (ej. un auto que se había
 * deshabilitado y se volvió a habilitar). Es una acción de bajo riesgo y
 * reversible (el admin puede volver a archivar a mano), a diferencia de
 * archivar automáticamente: eso sigue prohibido, porque `avail`/`units` son
 * ambiguos por unidad física (ver docs/wordpress-mapping.md) y archivar por
 * error saca un auto operativo de circulación sin que nadie lo note.
 */
export async function seedFleetFromWp(
  source?: BookingSource,
): Promise<{ created: number; existing: number; models: number; reactivated: number }> {
  const src = source ?? createBookingSource();
  let cars: RawCar[];
  try {
    cars = await src.fetchCars();
  } finally {
    await src.close?.();
  }

  let created = 0;
  let existing = 0;
  let reactivated = 0;
  for (const car of cars) {
    const { brand, model } = splitName(car.name);
    for (let index = 1; index <= car.units; index++) {
      const found = await prisma.vehicle.findUnique({
        where: { wpCarId_wpCarIndex: { wpCarId: car.id, wpCarIndex: index } },
        select: { id: true, archivedAt: true },
      });
      if (found) {
        existing++;
        if (car.avail === true && found.archivedAt != null) {
          await prisma.vehicle.update({ where: { id: found.id }, data: { archivedAt: null } });
          reactivated++;
        }
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
  return { created, existing, models: cars.length, reactivated };
}

function splitName(name: string): { brand: string; model: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return { brand: name.trim() || "—", model: name.trim() || "—" };
  return { brand: parts[0], model: parts.slice(1).join(" ") };
}
