import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";
import { ButtonLink } from "@/components/ui/button";
import { RentalList } from "@/components/rentals/rental-list";
import { RentalFiltersForm } from "@/components/rentals/rental-filters-form";
import { parseRentalListFilters, buildRentalWhereClauses } from "@/lib/rental-list-filters";
import { getRentalListData } from "@/lib/rental-list-queries";

export const metadata: Metadata = { title: "Alquileres — Andes" };

export default async function RentalsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    confirm?: string;
    desde?: string;
    hasta?: string;
    sort?: string;
    cp?: string;
    pp?: string;
  }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const filters = parseRentalListFilters(sp);
  const { currentWhere, pastWhere } = buildRentalWhereClauses(filters);
  const { current, currentTotal, currentPage, currentTotalPages, past, pastTotal, pastPage, pastTotalPages } =
    await getRentalListData(currentWhere, pastWhere, {
      sort: filters.sort,
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
    if (filters.sort !== "fecha") params.set("sort", filters.sort);
    if (section === "cp" && page > 1) params.set("cp", String(page));
    if (section === "cp" && filters.pastPage > 1) params.set("pp", String(filters.pastPage));
    if (section === "pp" && page > 1) params.set("pp", String(page));
    if (section === "pp" && filters.currentPage > 1) params.set("cp", String(filters.currentPage));
    const qs = params.toString();
    return qs ? `/rentals?${qs}#${section}` : `/rentals#${section}`;
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alquileres</h1>
          <p className="text-sm text-foreground/60">
            {filters.hasFilters
              ? `${currentTotal + pastTotal} resultado${currentTotal + pastTotal === 1 ? "" : "s"}`
              : `${currentTotal} actual${currentTotal === 1 ? "" : "es"} · ${pastTotal} pasado${pastTotal === 1 ? "" : "s"}`}
          </p>
        </div>
        <ButtonLink href="/rentals/new">Nuevo manual</ButtonLink>
      </div>

      <RentalFiltersForm {...filters} />

      {current.length === 0 && past.length === 0 ? (
        <p className="rounded-lg border border-foreground/10 p-6 text-center text-sm text-foreground/60">
          {filters.hasFilters ? "Sin resultados." : "Todavía no hay alquileres."}
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
    </div>
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
