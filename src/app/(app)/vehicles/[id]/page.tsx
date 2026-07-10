import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { vehicleStatusLabels } from "@/lib/labels";
import { vehicleStatusTone } from "@/lib/vehicle-ui";

export const metadata: Metadata = { title: "Vehículo — Andes" };

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="text-foreground/60">{label}</span>
      <span className="text-right font-medium">{value ?? "—"}</span>
    </div>
  );
}

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const isAdmin = user.role === "admin";

  const vehicle = await prisma.vehicle.findUnique({ where: { id } });
  if (!vehicle) notFound();

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {vehicle.brand} {vehicle.model}
          </h1>
          <p className="text-sm text-foreground/60">{vehicle.plate}</p>
        </div>
        <Badge tone={vehicleStatusTone[vehicle.status]}>
          {vehicleStatusLabels[vehicle.status]}
        </Badge>
      </div>

      <div className="divide-y divide-foreground/10 rounded-xl border border-foreground/10 px-4">
        <Row label="Año" value={vehicle.year} />
        <Row label="Color" value={vehicle.color} />
        <Row label="Kilometraje" value={`${vehicle.currentKm.toLocaleString("es-AR")} km`} />
        <Row label="Próximo service" value={vehicle.nextServiceKm ? `${vehicle.nextServiceKm.toLocaleString("es-AR")} km` : "—"} />
        <Row label="Mapeo VikRentCar" value={vehicle.wpCarId ? `idcar ${vehicle.wpCarId} · unidad ${vehicle.wpCarIndex}` : "Sin mapear"} />
        <Row label="Notas" value={vehicle.notes} />
      </div>

      {isAdmin ? (
        <div className="flex gap-3">
          <ButtonLink href={`/vehicles/${vehicle.id}/edit`}>Editar</ButtonLink>
          <ButtonLink href="/vehicles" variant="secondary">
            Volver
          </ButtonLink>
        </div>
      ) : (
        <ButtonLink href="/vehicles" variant="secondary">
          Volver
        </ButtonLink>
      )}

      <p className="text-xs text-foreground/40">
        El historial de alquileres, inspecciones y mantenimiento llega en la Fase 4.
      </p>
    </div>
  );
}
