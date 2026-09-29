import "server-only";
import { prisma } from "@/lib/prisma";

export async function getVehicleDetail(id: string) {
  return prisma.vehicle.findUnique({
    where: { id },
    include: {
      competitorCategory: { select: { label: true } },
      rentals: {
        orderBy: { startAt: "desc" },
        include: { inspections: { select: { type: true, km: true } } },
      },
      inspections: {
        orderBy: { createdAt: "asc" },
        include: {
          // startAt/endAt (fecha real de retiro/devolución) para el gráfico de
          // km: createdAt es cuándo se CARGÓ la inspección en Andes, que para
          // alquileres viejos cargados tarde (backfill) no coincide con la
          // fecha real del evento — ver KmChart.
          rental: { select: { clientName: true, startAt: true, endAt: true } },
        },
      },
      damages: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          posX: true,
          posY: true,
          description: true,
          photoUrl: true,
          repaired: true,
          createdAt: true,
          repairedAt: true,
          reportedByName: true,
          repairedByName: true,
        },
      },
      maintenanceLogs: { orderBy: { date: "desc" } },
      gpsDevices: { select: { identifier: true }, orderBy: { identifier: "asc" } },
      teamNotes: {
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export type VehicleDetail = NonNullable<Awaited<ReturnType<typeof getVehicleDetail>>>;
