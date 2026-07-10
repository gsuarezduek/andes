import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { vehicleStatusLabels } from "@/lib/labels";
import { vehicleStatusTone } from "@/lib/vehicle-ui";

export const metadata: Metadata = { title: "Vehículos — Andes" };

export default async function VehiclesPage() {
  const user = await requireUser();
  const isAdmin = user.role === "admin";

  const vehicles = await prisma.vehicle.findMany({
    orderBy: [{ brand: "asc" }, { model: "asc" }, { plate: "asc" }],
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vehículos</h1>
          <p className="text-sm text-foreground/60">{vehicles.length} en la flota</p>
        </div>
        {isAdmin ? <ButtonLink href="/vehicles/new">Nuevo</ButtonLink> : null}
      </div>

      {vehicles.length === 0 ? (
        <p className="rounded-lg border border-foreground/10 p-6 text-center text-sm text-foreground/60">
          Todavía no hay vehículos cargados.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
          {vehicles.map((v) => (
            <li key={v.id}>
              <Link
                href={`/vehicles/${v.id}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-foreground/[0.03]"
              >
                <div className="flex-1">
                  <p className="font-medium">
                    {v.brand} {v.model}
                  </p>
                  <p className="text-sm text-foreground/60">
                    {v.plate} · {v.currentKm.toLocaleString("es-AR")} km
                  </p>
                </div>
                <Badge tone={vehicleStatusTone[v.status]}>
                  {vehicleStatusLabels[v.status]}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
