"use client";

import { useMemo, useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { Button } from "@/components/ui/button";
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
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function handleMerge() {
    if (!selected) return;
    setError(undefined);
    start(async () => {
      try {
        await mergeDuplicateRental(duplicateId, selected.id);
      } catch (err) {
        unstable_rethrow(err);
        setConfirming(false);
        setError(err instanceof Error ? err.message : "No se pudo fusionar la reserva.");
      }
    });
  }

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

        {selected && !confirming && (
          <Button type="button" className="w-full" onClick={() => setConfirming(true)}>
            Fusionar con esta reserva
          </Button>
        )}

        {selected && confirming && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              ¿Fusionar esta reserva con <strong>{selected.label}</strong>? Esta cancela la
              actual y no se puede deshacer.
            </p>
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="text-xs text-foreground/50"
                disabled={pending}
              >
                Cancelar
              </button>
              <Button type="button" onClick={handleMerge} disabled={pending} className="ml-auto">
                {pending ? "Fusionando…" : "Sí, fusionar"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
