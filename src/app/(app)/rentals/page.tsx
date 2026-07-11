import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { rentalStatusLabels } from "@/lib/labels";
import { rentalStatusTone } from "@/lib/rental-ui";
import { formatDateTime } from "@/lib/datetime";

export const metadata: Metadata = { title: "Alquileres — Andes" };

export default async function RentalsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireUser();
  const { q } = await searchParams;
  const query = q?.trim();

  // Límite defensivo: sin él, al sincronizar miles de órdenes de VikRentCar la
  // lista traería todo. Se muestran los más recientes; el buscador acota el resto.
  const LIMIT = 50;
  const where = query
    ? {
        OR: [
          { clientName: { contains: query, mode: "insensitive" as const } },
          { vehicle: { plate: { contains: query, mode: "insensitive" as const } } },
        ],
      }
    : undefined;

  const [rentals, total] = await Promise.all([
    prisma.rental.findMany({
      where,
      orderBy: { startAt: "desc" },
      include: { vehicle: true },
      take: LIMIT,
    }),
    prisma.rental.count({ where }),
  ]);
  const hasMore = total > rentals.length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alquileres</h1>
          <p className="text-sm text-foreground/60">
            {query
              ? `${total} resultado${total === 1 ? "" : "s"}${hasMore ? ` · mostrando ${rentals.length}` : ""}`
              : `${total} en total${hasMore ? ` · mostrando los ${rentals.length} más recientes` : ""}`}
          </p>
        </div>
        <ButtonLink href="/rentals/new">Nuevo manual</ButtonLink>
      </div>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={query ?? ""}
          placeholder="Buscar por cliente o patente…"
          className="h-11 flex-1 rounded-lg border border-foreground/15 bg-transparent px-3 text-base outline-none focus:border-foreground/40"
        />
        <button className="h-11 rounded-lg border border-foreground/15 px-4 text-sm font-medium">
          Buscar
        </button>
      </form>

      {rentals.length === 0 ? (
        <p className="rounded-lg border border-foreground/10 p-6 text-center text-sm text-foreground/60">
          Todavía no hay alquileres.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
          {rentals.map((r) => (
            <li key={r.id}>
              <Link
                href={`/rentals/${r.id}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-foreground/[0.03]"
              >
                <div className="flex-1">
                  <p className="font-medium">{r.clientName}</p>
                  <p className="text-sm text-foreground/60">
                    {r.vehicle
                      ? `${r.vehicle.brand} ${r.vehicle.model} · ${r.vehicle.plate}`
                      : r.bookingModel
                        ? `${r.bookingModel} · sin unidad asignada`
                        : "Sin vehículo asignado"}
                  </p>
                  <p className="text-xs text-foreground/50">
                    {formatDateTime(r.startAt)} → {formatDateTime(r.endAt)}
                  </p>
                </div>
                <Badge tone={rentalStatusTone[r.status]}>
                  {rentalStatusLabels[r.status]}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <p className="text-center text-xs text-foreground/50">
          Hay más alquileres. Usá el buscador por cliente o patente para encontrarlos.
        </p>
      )}
    </div>
  );
}
