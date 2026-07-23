import Link from "next/link";
import { rentalStatusLabels } from "@/lib/labels";
import { RENTAL_STATUSES, type RentalListFilters } from "@/lib/rental-list-filters";

export function RentalFiltersForm({
  query,
  statusFilter,
  confirm,
  desde,
  hasta,
  hasFilters,
}: RentalListFilters) {
  return (
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
  );
}
