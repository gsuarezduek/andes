import "server-only";
import { prisma } from "@/lib/prisma";
import { vehicleBrandModel } from "@/lib/vehicle-ui";
import { deductibleConditions, deductiblesFor } from "@/lib/contract";
import type { GeneralConditions } from "@/lib/condition-lines";

/**
 * Condiciones económicas generales para el prompt del bot (Configuración →
 * Condiciones), con la franquicia de camionetas aparte y los modelos que son
 * camioneta — el bot habla de toda la flota y no sabe por sí solo que, por
 * ejemplo, la Spin cuenta como camioneta. Lo usan el bot real y el Playground.
 */
export async function getBotGeneralConditions(): Promise<GeneralConditions | null> {
  const [conditions, trucks] = await Promise.all([
    prisma.conditionSettings.findUnique({ where: { id: 1 } }),
    prisma.vehicle.findMany({
      where: { isTruck: true, archivedAt: null },
      select: { brand: true, model: true },
      orderBy: [{ brand: "asc" }, { model: "asc" }],
    }),
  ]);
  if (!conditions) return null;
  const deductibles = deductibleConditions(conditions);
  const truck = deductiblesFor(true, deductibles);
  return {
    kmPerDay: conditions.kmPerDay,
    extraKmRate: conditions.extraKmRate != null ? Number(conditions.extraKmRate) : null,
    deductible: deductibles.deductible,
    deductibleReduced: deductibles.deductibleReduced,
    truck: { ...truck, models: [...new Set(trucks.map((v) => vehicleBrandModel(v)))] },
  };
}
