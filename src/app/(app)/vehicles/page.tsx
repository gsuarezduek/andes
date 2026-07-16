import Link from "next/link";
import type { Metadata } from "next";
import type { Prisma, VehicleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { vehicleStatusLabels } from "@/lib/labels";
import { vehicleStatusTone } from "@/lib/vehicle-ui";
import { formatArs } from "@/lib/contract";
import { VehicleFilters } from "./vehicle-filters";

export const metadata: Metadata = { title: "Vehículos — Andes" };

type Sort = "model" | "price" | "plate" | "km";
const SORTS: Sort[] = ["model", "price", "plate", "km"];
const STATUS_FILTERS: VehicleStatus[] = ["available", "rented", "out_of_service"];

/** orderBy de Prisma según el criterio elegido (precio nullable → nulls al final). */
function orderByFor(sort: Sort, dir: "asc" | "desc"): Prisma.VehicleOrderByWithRelationInput[] {
  switch (sort) {
    case "price":
      return [{ dailyRate: { sort: dir, nulls: "last" } }, { brand: "asc" }, { model: "asc" }];
    case "plate":
      return [{ plate: dir }];
    case "km":
      return [{ currentKm: dir }];
    case "model":
    default:
      return [{ brand: dir }, { model: dir }, { plate: "asc" }];
  }
}

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string; sort?: string; dir?: string; status?: string }>;
}) {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const sp = await searchParams;
  const showArchived = sp.archived === "1";

  const sort: Sort = SORTS.includes(sp.sort as Sort) ? (sp.sort as Sort) : "model";
  const dir: "asc" | "desc" =
    sp.dir === "asc" || sp.dir === "desc" ? sp.dir : sort === "price" || sort === "km" ? "desc" : "asc";
  const statusFilter = STATUS_FILTERS.includes(sp.status as VehicleStatus)
    ? (sp.status as VehicleStatus)
    : null;

  const where: Prisma.VehicleWhereInput = {
    archivedAt: showArchived ? { not: null } : null,
    ...(statusFilter ? { status: statusFilter } : {}),
  };

  const [vehicles, archivedCount] = await Promise.all([
    prisma.vehicle.findMany({ where, orderBy: orderByFor(sort, dir) }),
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
              : statusFilter
                ? `${vehicles.length} resultado${vehicles.length === 1 ? "" : "s"}`
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

      <VehicleFilters sort={sort} dir={dir} status={statusFilter ?? "all"} />

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
                    {v.dailyRate != null ? ` · ${formatArs(Number(v.dailyRate))}/día` : ""}
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
