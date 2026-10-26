import "server-only";
import { prisma } from "@/lib/prisma";
import { vehicleDisplayName } from "@/lib/vehicle-ui";
import { dateToKey } from "@/lib/rooms/dates";
import type { FieldChange } from "@/lib/movement-audit";

export type PermitRow = {
  id: string;
  number: number;
  rentalId: string;
  clientName: string;
  vehicleLabel: string | null;
  formNumber: string;
  expiresAt: string; // "YYYY-MM-DD" — fecha pura, sin zona horaria
  fileUrl: string | null;
  createdByName: string;
  createdAt: Date;
};

/** Listado completo, más recientes primero (orden LIFO por `number`, que crece con la carga). */
export async function getPermits(): Promise<PermitRow[]> {
  const rows = await prisma.permit.findMany({
    where: { deletedAt: null },
    orderBy: { number: "desc" },
    include: {
      rental: {
        select: {
          clientName: true,
          vehicle: { select: { name: true, brand: true, model: true, plate: true } },
        },
      },
    },
  });
  return rows.map((p) => ({
    id: p.id,
    number: p.number,
    rentalId: p.rentalId,
    clientName: p.rental.clientName,
    vehicleLabel: p.rental.vehicle
      ? `${vehicleDisplayName(p.rental.vehicle)} · ${p.rental.vehicle.plate}`
      : null,
    formNumber: p.formNumber,
    expiresAt: dateToKey(p.expiresAt),
    fileUrl: p.fileUrl,
    createdByName: p.createdByName,
    createdAt: p.createdAt,
  }));
}

export type PermitEditRow = {
  id: string;
  action: "updated" | "deleted";
  changes: FieldChange[] | null;
  editedByName: string;
  permitNumber: number;
  createdAt: Date;
};

/** Historial de ediciones/borrados de Permisos (solo admin los ve). */
export async function getPermitEdits(): Promise<PermitEditRow[]> {
  const rows = await prisma.permitEdit.findMany({
    include: { permit: { select: { number: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    changes: (r.changes as FieldChange[] | null) ?? null,
    editedByName: r.editedByName,
    permitNumber: r.permit.number,
    createdAt: r.createdAt,
  }));
}
