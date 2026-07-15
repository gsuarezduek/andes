import Link from "next/link";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { rentalStatusLabels } from "@/lib/labels";
import { rentalStatusTone } from "@/lib/rental-ui";
import { formatDateTime } from "@/lib/datetime";

export const metadata: Metadata = { title: "Alquileres — Andes" };

// Fila del listado: patente (o modelo) primero, luego el nombre del cliente.
type RentalRow = Prisma.RentalGetPayload<{ include: { vehicle: true } }>;

function vehicleTitle(r: RentalRow): string {
  if (r.vehicle) return `${r.vehicle.plate} · ${r.vehicle.brand} ${r.vehicle.model}`;
  if (r.bookingModel) return `${r.bookingModel} · sin unidad asignada`;
  return "Sin vehículo asignado";
}

function RentalList({ rentals }: { rentals: RentalRow[] }) {
  return (
    <ul className="flex flex-col divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
      {rentals.map((r) => (
        <li key={r.id}>
          <Link
            href={`/rentals/${r.id}`}
            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-foreground/[0.03]"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{vehicleTitle(r)}</p>
              <p className="truncate text-sm text-foreground/70">{r.clientName}</p>
              <p className="text-xs text-foreground/50">
                {formatDateTime(r.startAt)} → {formatDateTime(r.endAt)}
              </p>
            </div>
            <Badge tone={rentalStatusTone[r.status]}>{rentalStatusLabels[r.status]}</Badge>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function RentalsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireUser();
  const { q } = await searchParams;
  const query = q?.trim();

  // Límite defensivo por sección: sin él, al sincronizar miles de órdenes de
  // VikRentCar la lista traería todo.
  const LIMIT = 50;
  const search: Prisma.RentalWhereInput | undefined = query
    ? {
        OR: [
          { clientName: { contains: query, mode: "insensitive" } },
          { vehicle: { plate: { contains: query, mode: "insensitive" } } },
        ],
      }
    : undefined;

  // "Actuales": la devolución aún no pasó, o el alquiler está activo (el auto
  // sigue afuera aunque esté vencido → hay que hacer la devolución). "Pasados":
  // la fecha de devolución ya pasó y no está activo — sin importar el estado,
  // porque muchos alquileres viejos se cerraron en papel y siguen "reservados".
  const now = new Date();
  const searchAnd = search ? [search] : [];
  const currentWhere: Prisma.RentalWhereInput = {
    AND: [...searchAnd, { OR: [{ endAt: { gte: now } }, { status: "active" }] }],
  };
  const pastWhere: Prisma.RentalWhereInput = {
    AND: [...searchAnd, { endAt: { lt: now } }, { status: { not: "active" } }],
  };

  const [current, currentTotal, past, pastTotal] = await Promise.all([
    prisma.rental.findMany({
      where: currentWhere,
      orderBy: { startAt: "asc" }, // en curso primero, luego los próximos
      include: { vehicle: true },
      take: LIMIT,
    }),
    prisma.rental.count({ where: currentWhere }),
    prisma.rental.findMany({
      where: pastWhere,
      orderBy: { endAt: "desc" }, // los que terminaron hace menos, primero
      include: { vehicle: true },
      take: LIMIT,
    }),
    prisma.rental.count({ where: pastWhere }),
  ]);

  const currentMore = currentTotal > current.length;
  const pastMore = pastTotal > past.length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alquileres</h1>
          <p className="text-sm text-foreground/60">
            {query
              ? `${currentTotal + pastTotal} resultado${currentTotal + pastTotal === 1 ? "" : "s"}`
              : `${currentTotal} actual${currentTotal === 1 ? "" : "es"} · ${pastTotal} pasado${pastTotal === 1 ? "" : "s"}`}
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

      {current.length === 0 && past.length === 0 ? (
        <p className="rounded-lg border border-foreground/10 p-6 text-center text-sm text-foreground/60">
          {query ? "Sin resultados." : "Todavía no hay alquileres."}
        </p>
      ) : (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
              Actuales{currentTotal > 0 ? ` (${currentTotal})` : ""}
            </h2>
            {current.length === 0 ? (
              <p className="rounded-lg border border-foreground/10 px-4 py-3 text-sm text-foreground/50">
                No hay alquileres actuales.
              </p>
            ) : (
              <RentalList rentals={current} />
            )}
            {currentMore && (
              <p className="text-center text-xs text-foreground/50">
                Hay más. Usá el buscador por cliente o patente.
              </p>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
              Pasados{pastTotal > 0 ? ` (${pastTotal})` : ""}
            </h2>
            {past.length === 0 ? (
              <p className="rounded-lg border border-foreground/10 px-4 py-3 text-sm text-foreground/50">
                No hay alquileres pasados.
              </p>
            ) : (
              <RentalList rentals={past} />
            )}
            {pastMore && (
              <p className="text-center text-xs text-foreground/50">
                Mostrando los {past.length} más recientes. Usá el buscador para encontrar otros.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
