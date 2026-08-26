"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { RentalPickerOption } from "@/lib/cash";

const MAX_MATCHES = 8;

/**
 * Buscador rápido del Home: cliente, patente u orden #, salta directo al
 * detalle de la reserva. Reusa las mismas candidatas que el picker de Caja
 * (reservadas/activas + recién devueltas) — es la misma pregunta ("¿cuál es
 * esta reserva?"), solo que acá el destino es navegar, no llenar un form.
 */
export function HomeSearch({ options }: { options: RentalPickerOption[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return options
      .filter(
        (o) =>
          o.clientName.toLowerCase().includes(q) ||
          (o.bookingId?.includes(q) ?? false) ||
          (o.plate?.toLowerCase().includes(q) ?? false) ||
          (o.vehicleName?.toLowerCase().includes(q) ?? false),
      )
      .slice(0, MAX_MATCHES);
  }, [query, options]);

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Buscar por cliente, patente, nombre del auto u orden #…"
        className="h-11 w-full rounded-lg border border-foreground/15 bg-transparent px-3 text-base outline-none focus:border-foreground/40"
      />
      {open && matches.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-foreground/10 bg-background py-1 shadow-lg">
          {matches.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => router.push(`/rentals/${o.id}`)}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-foreground/5"
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && query.trim() && matches.length === 0 && (
        <p className="absolute z-20 mt-1 w-full rounded-lg border border-foreground/10 bg-background px-3 py-2 text-sm text-foreground/50 shadow-lg">
          Sin coincidencias.
        </p>
      )}
    </div>
  );
}
