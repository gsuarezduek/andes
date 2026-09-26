import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth-helpers";
import { listRooms } from "@/lib/rooms/queries";
import { formatArs } from "@/lib/contract";
import { formatDateTime } from "@/lib/datetime";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { FleetTabs } from "@/components/rooms/fleet-tabs";

export const metadata: Metadata = { title: "Habitaciones — Andes" };

/** "2026-09-30" → "30/09". */
const short = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;

export default async function RoomsPage({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const showArchived = (await searchParams).archived === "1";
  const [rooms, archivedRooms] = await Promise.all([listRooms({ archived: showArchived }), listRooms({ archived: true })]);

  return (
    <div className="flex flex-col gap-5">
      <FleetTabs active="rooms" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Habitaciones</h1>
          <p className="text-sm text-foreground/60">
            Alquiler temporario (Airbnb, Booking y directas).{" "}
            {showArchived ? `${rooms.length} archivada${rooms.length === 1 ? "" : "s"}` : `${rooms.length} activa${rooms.length === 1 ? "" : "s"}`}
          </p>
        </div>
        {isAdmin ? <ButtonLink href="/rooms/new">Nueva</ButtonLink> : null}
      </div>

      {(showArchived || archivedRooms.length > 0) && (
        <div className="flex gap-4 text-sm">
          <Link href="/rooms" className={!showArchived ? "font-semibold" : "text-foreground/60 hover:text-foreground"}>
            Activas
          </Link>
          <Link href="/rooms?archived=1" className={showArchived ? "font-semibold" : "text-foreground/60 hover:text-foreground"}>
            Archivadas ({archivedRooms.length})
          </Link>
        </div>
      )}

      {rooms.length === 0 ? (
        <p className="rounded-lg border border-foreground/10 p-6 text-center text-sm text-foreground/60">
          {showArchived ? "No hay habitaciones archivadas." : "Todavía no hay habitaciones cargadas."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
          {rooms.map((r) => (
            <li key={r.id}>
              <Link href={`/rooms/${r.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-foreground/[0.03]">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    <span className="truncate">{r.name}</span>
                    {r.current ? (
                      <Badge tone={r.current.inHouse ? "emerald" : "blue"}>
                        {r.current.inHouse ? "Ocupada" : "Próxima entrada"}
                      </Badge>
                    ) : (
                      <Badge tone="neutral">Libre</Badge>
                    )}
                    {r.lastSyncFailed ? <Badge tone="red">Error de sync</Badge> : null}
                  </p>
                  <p className="truncate text-sm text-foreground/60">
                    {r.nightlyRate != null ? `${formatArs(r.nightlyRate)}/noche` : "Sin tarifa"}
                    {r.capacity ? ` · ${r.capacity} pers.` : ""}
                    {r.current ? ` · ${r.current.guest}: ${short(r.current.startDate)} → ${short(r.current.endDate)}` : ""}
                  </p>
                  <p className="text-xs text-foreground/40">
                    {r.feedCount === 0
                      ? "Sin calendarios conectados"
                      : `${r.feedCount} calendario${r.feedCount === 1 ? "" : "s"}${r.lastSyncAt ? ` · sync ${formatDateTime(r.lastSyncAt)}` : ""}`}
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
