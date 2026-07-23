import { prisma } from "@/lib/prisma";

export async function getRentalDetail(id: string) {
  return prisma.rental.findUnique({
    where: { id },
    include: {
      vehicle: true,
      inspections: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { name: true } } },
      },
      documents: { orderBy: { createdAt: "asc" } },
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

export type RentalDetail = NonNullable<Awaited<ReturnType<typeof getRentalDetail>>>;

/** Vehículos disponibles para el picker de "Datos" (antes de la entrega). */
export async function getEditableVehicles() {
  return prisma.vehicle.findMany({
    where: { archivedAt: null },
    orderBy: [{ brand: "asc" }, { model: "asc" }],
    select: { id: true, plate: true, brand: true, model: true },
  });
}
