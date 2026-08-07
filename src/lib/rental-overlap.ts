import "server-only";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/datetime";

/**
 * Busca una reserva/alquiler vigente (reserved/active — no cancelado ni
 * finalizado) del mismo vehículo cuyas fechas se solapen con [startAt, endAt).
 * Excluye `excludeRentalId` (la propia reserva, al reasignar su vehículo).
 */
export async function findOverlappingRental(
  vehicleId: string,
  startAt: Date,
  endAt: Date,
  excludeRentalId?: string,
) {
  return prisma.rental.findFirst({
    where: {
      vehicleId,
      status: { in: ["reserved", "active"] },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
      ...(excludeRentalId ? { id: { not: excludeRentalId } } : {}),
    },
    select: { clientName: true, startAt: true, endAt: true },
  });
}

export function overlapErrorMessage(clash: { clientName: string; startAt: Date; endAt: Date }) {
  return `Ese vehículo ya tiene una reserva de ${clash.clientName} entre el ${formatDateTime(clash.startAt)} y el ${formatDateTime(clash.endAt)}. Elegí otro vehículo o ajustá las fechas.`;
}
