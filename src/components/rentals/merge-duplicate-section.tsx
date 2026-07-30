"use client";

import { useMemo, useState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { mergeDuplicateRental } from "@/app/(app)/rentals/[id]/merge-actions";
import type { MergeCandidate } from "@/lib/rental-detail-queries";

const MAX_MATCHES = 8;

export function MergeDuplicateSection({
  duplicateId,
  candidates,
}: {
  duplicateId: string;
  candidates: MergeCandidate[];
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<MergeCandidate | null>(null);
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return candidates
      .filter((c) => c.clientName.toLowerCase().includes(q) || (c.vehiclePlate?.toLowerCase().includes(q) ?? false))
      .slice(0, MAX_MATCHES);
  }, [query, candidates]);

  return (
    <details className="rounded-xl border border-amber-500/20">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-amber-700 dark:text-amber-400">
        ¿Es un duplicado? Fusionar con otra reserva
      </summary>
      <div className="flex flex-col gap-3 border-t border-amber-500/20 p-4">
        <p className="text-xs text-foreground/60">
          Usalo cuando esta reserva es la orden que se cargó en VikRentCar solo para bloquear el
          auto en la web, y el alquiler real ya se entregó con otra carga en Andes. Mueve el
          vínculo con VikRentCar a la reserva elegida y cancela esta (así el próximo sync no la
          vuelve a traer duplicada).
        </p>

        {selected ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-foreground/15 px-3 py-2 text-sm">
            <span className="min-w-0 truncate">{selected.label}</span>
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                setQuery("");
              }}
              className="shrink-0 text-xs text-foreground/50"
            >
              Quitar
            </button>
          </div>
        ) : (
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
              placeholder="Nombre del cliente o patente…"
              className="h-11 w-full rounded-lg border border-foreground/15 bg-transparent px-3 text-base outline-none focus:border-foreground/40"
            />
            {open && matches.length > 0 && (
              <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-foreground/10 bg-background py-1 shadow-lg">
                {matches.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(c);
                        setQuery("");
                        setOpen(false);
                      }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-foreground/5"
                    >
                      {c.label}
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
        )}

        {selected && (
          <form action={mergeDuplicateRental.bind(null, duplicateId, selected.id)}>
            <SubmitButton pendingLabel="Fusionando…" className="w-full">
              Fusionar con esta reserva
            </SubmitButton>
          </form>
        )}
      </div>
    </details>
  );
}
