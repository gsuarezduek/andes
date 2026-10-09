import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth-helpers";
import { listThirdPartyVehicles } from "@/lib/third-party-vehicles/queries";
import { formatDateTime } from "@/lib/datetime";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { FleetTabs } from "@/components/rooms/fleet-tabs";

export const metadata: Metadata = { title: "Vehículos de terceros — Andes" };

export default async function ThirdPartyVehiclesPage({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const showArchived = (await searchParams).archived === "1";
  const [vehicles, archivedVehicles] = await Promise.all([
    listThirdPartyVehicles({ archived: showArchived }),
    listThirdPartyVehicles({ archived: true }),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <FleetTabs active="thirdParty" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vehículos de terceros</h1>
          <p className="text-sm text-foreground/60">
            Autos que no son de la flota propia, con reservas manuales visibles en el Calendario.{" "}
            {showArchived
              ? `${vehicles.length} archivado${vehicles.length === 1 ? "" : "s"}`
              : `${vehicles.length} activo${vehicles.length === 1 ? "" : "s"}`}
          </p>
        </div>
        {isAdmin ? <ButtonLink href="/third-party-vehicles/new">Nuevo</ButtonLink> : null}
      </div>

      {(showArchived || archivedVehicles.length > 0) && (
        <div className="flex gap-4 text-sm">
          <Link href="/third-party-vehicles" className={!showArchived ? "font-semibold" : "text-foreground/60 hover:text-foreground"}>
            Activos
          </Link>
          <Link
            href="/third-party-vehicles?archived=1"
            className={showArchived ? "font-semibold" : "text-foreground/60 hover:text-foreground"}
          >
            Archivados ({archivedVehicles.length})
          </Link>
        </div>
      )}

      {vehicles.length === 0 ? (
        <p className="rounded-lg border border-foreground/10 p-6 text-center text-sm text-foreground/60">
          {showArchived ? "No hay vehículos de terceros archivados." : "Todavía no hay vehículos de terceros cargados."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
          {vehicles.map((v) => (
            <li key={v.id}>
              <Link href={`/third-party-vehicles/${v.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-foreground/[0.03]">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    <span className="truncate">
                      {v.plate} · {v.brand} {v.model}
                    </span>
                    {v.current ? (
                      <Badge tone={v.current.inProgress ? "emerald" : "blue"}>{v.current.inProgress ? "En uso" : "Próxima reserva"}</Badge>
                    ) : (
                      <Badge tone="neutral">Libre</Badge>
                    )}
                  </p>
                  <p className="truncate text-sm text-foreground/60">
                    Titular: {v.ownerName}
                    {v.current ? ` · ${v.current.clientName}: ${formatDateTime(v.current.startAt)} → ${formatDateTime(v.current.endAt)}` : ""}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
