import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { vehicleStatusLabels } from "@/lib/labels";
import { vehicleStatusTone } from "@/lib/vehicle-ui";

export const metadata: Metadata = { title: "Vehículos — Andes" };

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const showArchived = (await searchParams).archived === "1";

  const [vehicles, archivedCount] = await Promise.all([
    prisma.vehicle.findMany({
      where: { archivedAt: showArchived ? { not: null } : null },
      orderBy: [{ brand: "asc" }, { model: "asc" }, { plate: "asc" }],
    }),
    prisma.vehicle.count({ where: { archivedAt: { not: null } } }),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vehículos</h1>
          <p className="text-sm text-foreground/60">
            {showArchived
              ? `${vehicles.length} archivado${vehicles.length === 1 ? "" : "s"}`
              : `${vehicles.length} en la flota`}
          </p>
        </div>
        {isAdmin ? (
          <div className="flex gap-2">
            <ButtonLink href="/vehicles/qr" variant="secondary">QR de la flota</ButtonLink>
            <ButtonLink href="/vehicles/new">Nuevo</ButtonLink>
          </div>
        ) : null}
      </div>

      {(showArchived || archivedCount > 0) && (
        <div className="flex gap-4 text-sm">
          <Link
            href="/vehicles"
            className={!showArchived ? "font-semibold" : "text-foreground/60 hover:text-foreground"}
          >
            En la flota
          </Link>
          <Link
            href="/vehicles?archived=1"
            className={showArchived ? "font-semibold" : "text-foreground/60 hover:text-foreground"}
          >
            Archivados ({archivedCount})
          </Link>
        </div>
      )}

      {vehicles.length === 0 ? (
        <p className="rounded-lg border border-foreground/10 p-6 text-center text-sm text-foreground/60">
          {showArchived ? "No hay vehículos archivados." : "Todavía no hay vehículos cargados."}
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
