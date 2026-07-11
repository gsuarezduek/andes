import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { vehicleStatusLabels } from "@/lib/labels";
import { vehicleStatusTone } from "@/lib/vehicle-ui";
import { formatDateTime } from "@/lib/datetime";

export const metadata: Metadata = { title: "Vehículo — Andes" };

/**
 * Landing del QR pegado en el auto. Resuelve el estado del vehículo y ofrece la
 * acción que corresponde (iniciar entrega / devolución) sin tener que buscar la
 * reserva. Protegida como toda la app: si no hay sesión, pasa por /login.
 */
export default async function VehicleQrLanding({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();

  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: {
      rentals: {
        where: { status: { in: ["reserved", "active"] } },
        orderBy: { startAt: "asc" },
        include: { inspections: { select: { type: true } } },
      },
    },
  });
  if (!vehicle) notFound();

  // Devolución pendiente: alquiler activo, con entrega y sin devolución.
  const returnable = vehicle.rentals.find(
    (r) =>
      r.status === "active" &&
      r.inspections.some((i) => i.type === "handover") &&
      !r.inspections.some((i) => i.type === "return_"),
  );
  // Entrega pendiente: reserva sin entrega (la más próxima).
  const handoverable = vehicle.rentals.find(
    (r) => r.status === "reserved" && !r.inspections.some((i) => i.type === "handover"),
  );

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {vehicle.brand} {vehicle.model}
          </h1>
          <p className="text-sm text-foreground/60">{vehicle.plate}</p>
        </div>
        <Badge tone={vehicleStatusTone[vehicle.status]}>{vehicleStatusLabels[vehicle.status]}</Badge>
      </div>

      <div className="flex flex-col gap-3">
        {returnable && (
          <div className="flex flex-col gap-2 rounded-xl border border-foreground/10 p-4">
            <p className="text-sm">
              Devolución pendiente · <span className="font-medium">{returnable.clientName}</span>
            </p>
            <p className="text-xs text-foreground/50">Vuelta esperada {formatDateTime(returnable.endAt)}</p>
            <ButtonLink href={`/rentals/${returnable.id}/return`}>Iniciar devolución</ButtonLink>
          </div>
        )}

        {handoverable && (
          <div className="flex flex-col gap-2 rounded-xl border border-foreground/10 p-4">
            <p className="text-sm">
              Entrega pendiente · <span className="font-medium">{handoverable.clientName}</span>
            </p>
            <p className="text-xs text-foreground/50">Retiro {formatDateTime(handoverable.startAt)}</p>
            <ButtonLink href={`/rentals/${handoverable.id}/handover`}>Iniciar entrega</ButtonLink>
          </div>
        )}

        {!returnable && !handoverable && (
          <p className="rounded-xl border border-foreground/10 px-4 py-3 text-sm text-foreground/50">
            Este vehículo no tiene entregas ni devoluciones pendientes.
          </p>
        )}

        <ButtonLink href={`/vehicles/${vehicle.id}`} variant="secondary">
          Ver perfil del vehículo
        </ButtonLink>
      </div>
    </div>
  );
}
