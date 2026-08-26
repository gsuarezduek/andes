import "server-only";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/datetime";

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
      // Historial de pagos de esta reserva: entrada única de verdad, ya sea
      // el pago rápido de esta pantalla, el de la entrega o el de la
      // liquidación de la devolución (todos crean un CashMovement acá).
      cashMovements: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        include: { createdBy: { select: { name: true } } },
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

export type MergeCandidate = {
  id: string;
  clientName: string;
  startAt: Date;
  vehiclePlate: string | null;
  label: string;
};

/**
 * Reservas candidatas para "fusionar" un duplicado (una reserva importada de
 * VikRentCar creada solo para bloquear el auto en la web, sin entrega real)
 * con la reserva que sí se entregó. Solo tiene sentido vincular a reservas
 * que todavía NO tienen `wpBookingId` propio (si ya lo tuvieran, fusionar acá
 * las dejaría huérfanas de su propia orden).
 */
export async function getMergeCandidates(excludeId: string): Promise<MergeCandidate[]> {
  const rentals = await prisma.rental.findMany({
    where: {
      id: { not: excludeId },
      wpBookingId: null,
      // Ni canceladas ni un placeholder de service: ninguna de las dos es un
      // destino válido para fusionar la orden real de un cliente.
      status: { notIn: ["cancelled", "out_of_service"] },
    },
    orderBy: { updatedAt: "desc" },
    take: 150,
    select: {
      id: true,
      clientName: true,
      startAt: true,
      vehicle: { select: { plate: true } },
    },
  });

  return rentals.map((r) => ({
    id: r.id,
    clientName: r.clientName,
    startAt: r.startAt,
    vehiclePlate: r.vehicle?.plate ?? null,
    label: `${r.clientName} · ${formatDate(r.startAt)}${r.vehicle ? ` · ${r.vehicle.plate}` : ""}`,
  }));
}
