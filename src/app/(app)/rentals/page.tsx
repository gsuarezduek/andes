import type { Metadata } from "next";
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
  }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const filters = parseRentalListFilters(sp);
  const { currentWhere, pastWhere } = buildRentalWhereClauses(filters);
  const { current, currentTotal, past, pastTotal, currentMore, pastMore } =
    await getRentalListData(currentWhere, pastWhere);

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
