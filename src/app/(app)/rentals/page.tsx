import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";
import { ButtonLink } from "@/components/ui/button";
import { RentalList } from "@/components/rentals/rental-list";
import { ProximasSection } from "@/components/rentals/proximas-section";
import { RentalFiltersForm } from "@/components/rentals/rental-filters-form";
import { parseRentalListFilters, buildRentalWhereClauses } from "@/lib/rental-list-filters";
import { getRentalListData, getRentalListOverview, type RentalRow } from "@/lib/rental-list-queries";
import { groupUpcomingByMonth } from "@/lib/rental-list-grouping";

export const metadata: Metadata = { title: "Alquileres — Andes" };

type RentalListOrder = "retiro" | "reserva";

export default async function RentalsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    confirm?: string;
    desde?: string;
    hasta?: string;
    cp?: string;
    pp?: string;
    orden?: string;
  }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const filters = parseRentalListFilters(sp);
  const order: RentalListOrder = sp.orden === "reserva" ? "reserva" : "retiro";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Alquileres</h1>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {!filters.hasFilters && <RentalOrderToggle active={order} />}
          <ButtonLink href="/rentals/new">Nuevo manual</ButtonLink>
        </div>
      </div>

      <RentalFiltersForm {...filters} />

      {filters.hasFilters ? (
        <FilteredResults filters={filters} />
      ) : (
        <DefaultOverview order={order} />
      )}
    </div>
  );
}

const RENTAL_ORDER_LABELS: Record<RentalListOrder, string> = {
  retiro: "Fecha de retiro",
  reserva: "Fecha de reserva",
};

/**
 * Chips de navegación (GET, sin JS) para elegir cómo se ordena/agrupa toda
 * la vista curada por defecto (Atrasadas + Alquilados + Próximas, no solo
 * una sección) — ver `DefaultOverview`.
 */
function RentalOrderToggle({ active }: { active: RentalListOrder }) {
  return (
    <div className="flex gap-2 text-sm">
      {(Object.entries(RENTAL_ORDER_LABELS) as [RentalListOrder, string][]).map(([value, label]) => (
        <Link
          key={value}
          href={value === "retiro" ? "/rentals" : "/rentals?orden=reserva"}
          className={`rounded-lg border px-3 py-1.5 font-medium transition-colors ${
            value === active
              ? "border-foreground bg-foreground text-background"
              : "border-foreground/25 text-foreground/70 hover:bg-foreground/5"
          }`}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

function bookedAt(r: RentalRow): Date {
  return r.bookingCreatedAt ?? r.createdAt;
}

/**
 * Vista curada por defecto (sin filtros). "Pasados" queda completamente
 * afuera — se accede buscando por fecha o estado.
 *
 * Dos órdenes, elegidos con `RentalOrderToggle` arriba de todo:
 * - **Fecha de retiro** (default): Atrasadas (si hay) → Alquilados →
 *   Próximas agrupadas por mes de retiro (el mes actual, por día) — para
 *   planificar qué se viene.
 * - **Fecha de reserva**: las tres categorías se aplanan en una sola lista
 *   ordenada por cuándo entró el pedido (más reciente primero;
 *   `bookingCreatedAt` con fallback a `createdAt` para cargas manuales) —
 *   para ver la actividad reciente sin importar si el auto ya salió, está
 *   atrasado o todavía no arrancó.
 */
async function DefaultOverview({ order }: { order: RentalListOrder }) {
  const now = new Date();
  const { atrasadas, alquilados, proximas } = await getRentalListOverview(now);

  if (atrasadas.length === 0 && alquilados.length === 0 && proximas.length === 0) {
    return (
      <p className="rounded-lg border border-foreground/10 p-6 text-center text-sm text-foreground/60">
        Todavía no hay alquileres.
      </p>
    );
  }

  if (order === "reserva") {
    const ultimas = [...atrasadas, ...alquilados, ...proximas].sort(
      (a, b) => bookedAt(b).getTime() - bookedAt(a).getTime(),
    );
    return (
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
          Últimas reservas ({ultimas.length})
        </h2>
        <RentalList rentals={ultimas} showBookedAt />
      </section>
    );
  }

  return (
    <>
      {atrasadas.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">
            Atrasadas para entregar ({atrasadas.length})
          </h2>
          <RentalList rentals={atrasadas} />
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
          Alquilados{alquilados.length > 0 ? ` (${alquilados.length})` : ""}
        </h2>
        {alquilados.length === 0 ? (
          <p className="rounded-lg border border-foreground/10 px-4 py-3 text-sm text-foreground/50">
            No hay autos alquilados ahora mismo.
          </p>
        ) : (
          <RentalList rentals={alquilados} />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
          Próximas{proximas.length > 0 ? ` (${proximas.length})` : ""}
        </h2>
        {proximas.length === 0 ? (
          <p className="rounded-lg border border-foreground/10 px-4 py-3 text-sm text-foreground/50">
            No hay reservas próximas.
          </p>
        ) : (
          <ProximasSection months={groupUpcomingByMonth(proximas, now)} />
        )}
      </section>
    </>
  );
}

/** Vista de resultados con filtros activos: Actuales + Pasados, sin curar. */
async function FilteredResults({ filters }: { filters: ReturnType<typeof parseRentalListFilters> }) {
  const { currentWhere, pastWhere } = buildRentalWhereClauses(filters);
  const { current, currentTotal, currentPage, currentTotalPages, past, pastTotal, pastPage, pastTotalPages } =
    await getRentalListData(currentWhere, pastWhere, {
      currentPage: filters.currentPage,
      pastPage: filters.pastPage,
    });

  // Preserva filtros/orden vigentes al cambiar de página en una sección sin tocar la otra.
  const pageHref = (section: "cp" | "pp", page: number) => {
    const params = new URLSearchParams();
    if (filters.query) params.set("q", filters.query);
    if (filters.statusFilter) params.set("status", filters.statusFilter);
    if (filters.confirm !== "all") params.set("confirm", filters.confirm);
    if (filters.desde) params.set("desde", filters.desde);
    if (filters.hasta) params.set("hasta", filters.hasta);
    if (section === "cp" && page > 1) params.set("cp", String(page));
    if (section === "cp" && filters.pastPage > 1) params.set("pp", String(filters.pastPage));
    if (section === "pp" && page > 1) params.set("pp", String(page));
    if (section === "pp" && filters.currentPage > 1) params.set("cp", String(filters.currentPage));
    const qs = params.toString();
    return qs ? `/rentals?${qs}#${section}` : `/rentals#${section}`;
  };

  return (
    <>
      <p className="text-sm text-foreground/60">
        {currentTotal + pastTotal} resultado{currentTotal + pastTotal === 1 ? "" : "s"}
      </p>

      {current.length === 0 && past.length === 0 ? (
        <p className="rounded-lg border border-foreground/10 p-6 text-center text-sm text-foreground/60">
          Sin resultados.
        </p>
      ) : (
        <>
          <section id="cp" className="flex scroll-mt-4 flex-col gap-2">
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
            {currentTotalPages > 1 && (
              <PageNav section="cp" page={currentPage} totalPages={currentTotalPages} pageHref={pageHref} />
            )}
          </section>

          <section id="pp" className="flex scroll-mt-4 flex-col gap-2">
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
            {pastTotalPages > 1 && (
              <PageNav section="pp" page={pastPage} totalPages={pastTotalPages} pageHref={pageHref} />
            )}
          </section>
        </>
      )}
    </>
  );
}

function PageNav({
  section,
  page,
  totalPages,
  pageHref,
}: {
  section: "cp" | "pp";
  page: number;
  totalPages: number;
  pageHref: (section: "cp" | "pp", page: number) => string;
}) {
  return (
    <div className="flex items-center justify-center gap-3 py-1 text-sm">
      {page > 1 ? (
        <Link href={pageHref(section, page - 1)} className="font-medium text-foreground/70 underline">
          ← Anterior
        </Link>
      ) : (
        <span className="text-foreground/30">← Anterior</span>
      )}
      <span className="text-xs text-foreground/50">
        Página {page} de {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={pageHref(section, page + 1)} className="font-medium text-foreground/70 underline">
          Siguiente →
        </Link>
      ) : (
        <span className="text-foreground/30">Siguiente →</span>
      )}
    </div>
  );
}
