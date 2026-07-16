"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const SORTS = [
  { value: "model", label: "Modelo" },
  { value: "price", label: "Precio (ref.)" },
  { value: "plate", label: "Patente" },
  { value: "km", label: "Kilometraje" },
] as const;

const STATUSES = [
  { value: "all", label: "Todos los estados" },
  { value: "available", label: "Disponibles" },
  { value: "rented", label: "Alquilados" },
  { value: "out_of_service", label: "Fuera de servicio" },
] as const;

/** Dirección natural por criterio: precio y km de mayor a menor; resto A→Z. */
function naturalDir(sort: string): "asc" | "desc" {
  return sort === "price" || sort === "km" ? "desc" : "asc";
}

const selectCls =
  "h-10 rounded-lg border border-foreground/15 bg-transparent px-2 text-sm outline-none focus:border-foreground/40";

export function VehicleFilters({
  sort,
  dir,
  status,
}: {
  sort: string;
  dir: "asc" | "desc";
  status: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const push = (changes: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(changes)) params.set(k, v);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Filtrar por estado"
        value={status}
        onChange={(e) => push({ status: e.target.value })}
        className={selectCls}
      >
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <select
        aria-label="Ordenar por"
        value={sort}
        // Al cambiar de criterio, arrancamos con su dirección natural.
        onChange={(e) => push({ sort: e.target.value, dir: naturalDir(e.target.value) })}
        className={selectCls}
      >
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            Ordenar: {s.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        aria-label="Invertir orden"
        onClick={() => push({ dir: dir === "asc" ? "desc" : "asc" })}
        className="h-10 rounded-lg border border-foreground/15 px-3 text-sm font-medium text-foreground/70 hover:border-foreground/40"
      >
        {dir === "asc" ? "↑ Asc" : "↓ Desc"}
      </button>
    </div>
  );
}
