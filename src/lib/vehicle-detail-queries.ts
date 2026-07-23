import { prisma } from "@/lib/prisma";

export async function getVehicleDetail(id: string) {
  return prisma.vehicle.findUnique({
    where: { id },
    include: {
      rentals: {
        orderBy: { startAt: "desc" },
        include: { inspections: { select: { type: true, km: true } } },
      },
      inspections: {
        orderBy: { createdAt: "asc" },
        include: {
          rental: { select: { clientName: true } },
          user: { select: { name: true } },
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
          reportedBy: { select: { name: true } },
          repairedBy: { select: { name: true } },
        },
      },
      maintenanceLogs: { orderBy: { date: "desc" } },
      teamNotes: {
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: { select: { name: true } },
          resolvedBy: { select: { name: true } },
        },
      },
    },
  });
}

export type VehicleDetail = NonNullable<Awaited<ReturnType<typeof getVehicleDetail>>>;
