import Link from "next/link";
import type { Metadata } from "next";
import type { Prisma, RentalStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { rentalStatusLabels } from "@/lib/labels";
import { rentalStatusTone } from "@/lib/rental-ui";
import { formatDateTime, mendozaWallTimeToUtc } from "@/lib/datetime";

export const metadata: Metadata = { title: "Alquileres — Andes" };

// Fila del listado: patente (o modelo) primero, luego el nombre del cliente.
type RentalRow = Prisma.RentalGetPayload<{ include: { vehicle: true } }>;

const RENTAL_STATUSES: RentalStatus[] = ["reserved", "active", "finished", "cancelled"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
              <p className="truncate text-sm text-foreground/70">
                {r.clientName}
                {r.wpBookingId ? (
                  <span className="text-foreground/45"> · Orden #{r.wpBookingId}</span>
                ) : null}
              </p>
              <p className="text-xs text-foreground/50">
                {formatDateTime(r.startAt)} → {formatDateTime(r.endAt)}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Badge tone={rentalStatusTone[r.status]}>{rentalStatusLabels[r.status]}</Badge>
              {!r.bookingConfirmed && <Badge tone="orange">Sin confirmar</Badge>}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function RentalsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    confirm?: string;
    desde?: string;
    hasta?: string;
  }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const query = sp.q?.trim();
  const statusFilter = RENTAL_STATUSES.includes(sp.status as RentalStatus)
    ? (sp.status as RentalStatus)
    : null;
  const confirm = sp.confirm === "confirmed" || sp.confirm === "unconfirmed" ? sp.confirm : "all";
  const desde = sp.desde && DATE_RE.test(sp.desde) ? sp.desde : "";
  const hasta = sp.hasta && DATE_RE.test(sp.hasta) ? sp.hasta : "";
  const hasFilters = Boolean(query || statusFilter || confirm !== "all" || desde || hasta);

  // Límite defensivo por sección: sin él, al sincronizar miles de órdenes de
  // VikRentCar la lista traería todo.
  const LIMIT = 50;

  // Filtros combinables (se aplican a "Actuales" y "Pasados").
  const filters: Prisma.RentalWhereInput[] = [];
  if (query) {
    const or: Prisma.RentalWhereInput[] = [
      { clientName: { contains: query, mode: "insensitive" } },
      { vehicle: { plate: { contains: query, mode: "insensitive" } } },
    ];
    // Un número también busca por N° de orden de VikRentCar.
    if (/^\d+$/.test(query)) or.push({ wpBookingId: Number(query) });
    filters.push({ OR: or });
  }
  if (statusFilter) filters.push({ status: statusFilter });
  if (confirm === "confirmed") filters.push({ bookingConfirmed: true });
  else if (confirm === "unconfirmed") filters.push({ bookingConfirmed: false });
  // Rango sobre la fecha de retiro (hora de Mendoza).
  const startAt: Prisma.DateTimeFilter = {};
  if (desde) startAt.gte = mendozaWallTimeToUtc(`${desde}T00:00`);
  if (hasta) startAt.lte = mendozaWallTimeToUtc(`${hasta}T23:59`);
  if (startAt.gte || startAt.lte) filters.push({ startAt });

  // "Actuales": la devolución aún no pasó, o el alquiler está activo (el auto
  // sigue afuera aunque esté vencido → hay que hacer la devolución). "Pasados":
  // la fecha de devolución ya pasó y no está activo — sin importar el estado,
  // porque muchos alquileres viejos se cerraron en papel y siguen "reservados".
  const now = new Date();
  const currentWhere: Prisma.RentalWhereInput = {
    AND: [...filters, { OR: [{ endAt: { gte: now } }, { status: "active" }] }],
  };
  const pastWhere: Prisma.RentalWhereInput = {
    AND: [...filters, { endAt: { lt: now } }, { status: { not: "active" } }],
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
            {hasFilters
              ? `${currentTotal + pastTotal} resultado${currentTotal + pastTotal === 1 ? "" : "s"}`
              : `${currentTotal} actual${currentTotal === 1 ? "" : "es"} · ${pastTotal} pasado${pastTotal === 1 ? "" : "s"}`}
          </p>
        </div>
        <ButtonLink href="/rentals/new">Nuevo manual</ButtonLink>
      </div>

      <form className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            name="q"
            defaultValue={query ?? ""}
            placeholder="Buscar por cliente, patente u orden #…"
            className="h-11 flex-1 rounded-lg border border-foreground/15 bg-transparent px-3 text-base outline-none focus:border-foreground/40"
          />
          <button className="h-11 rounded-lg border border-foreground/15 px-4 text-sm font-medium">
            Filtrar
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select
            name="status"
            defaultValue={statusFilter ?? ""}
            className="h-10 rounded-lg border border-foreground/15 bg-transparent px-2 text-sm outline-none focus:border-foreground/40"
          >
            <option value="">Todos los estados</option>
            {RENTAL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {rentalStatusLabels[s]}
              </option>
            ))}
          </select>
          <select
            name="confirm"
            defaultValue={confirm}
            className="h-10 rounded-lg border border-foreground/15 bg-transparent px-2 text-sm outline-none focus:border-foreground/40"
          >
            <option value="all">Confirmación: todas</option>
            <option value="confirmed">Confirmadas</option>
            <option value="unconfirmed">Sin confirmar</option>
          </select>
          <label className="flex items-center gap-1 text-xs text-foreground/60">
            Retiro desde
            <input
              type="date"
              name="desde"
              defaultValue={desde}
              className="h-10 rounded-lg border border-foreground/15 bg-transparent px-2 text-sm outline-none focus:border-foreground/40"
            />
          </label>
          <label className="flex items-center gap-1 text-xs text-foreground/60">
            hasta
            <input
              type="date"
              name="hasta"
              defaultValue={hasta}
              className="h-10 rounded-lg border border-foreground/15 bg-transparent px-2 text-sm outline-none focus:border-foreground/40"
            />
          </label>
          {hasFilters && (
            <Link href="/rentals" className="text-xs font-medium text-foreground/60 underline">
              Limpiar
            </Link>
          )}
        </div>
      </form>

      {current.length === 0 && past.length === 0 ? (
        <p className="rounded-lg border border-foreground/10 p-6 text-center text-sm text-foreground/60">
          {hasFilters ? "Sin resultados." : "Todavía no hay alquileres."}
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
                Hay más. Buscá por cliente, patente, orden o filtrá por fecha/estado.
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
                Mostrando los {past.length} más recientes. Buscá por cliente, patente, orden o filtrá por fecha/estado.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
