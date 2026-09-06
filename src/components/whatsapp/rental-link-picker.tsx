"use client";

import { useMemo, useState, useTransition } from "react";
import type { RentalPickerOption } from "@/lib/cash";
import { linkRental } from "@/app/(app)/whatsapp/actions";

const MAX_MATCHES = 8;

/** Buscador para vincular manualmente una reserva a esta conversación — mismo patrón que `HomeSearch`, pero linkea en vez de navegar. */
export function RentalLinkPicker({ conversationId, options }: { conversationId: string; options: RentalPickerOption[] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

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

  function pick(rentalId: string) {
    setQuery("");
    setOpen(false);
    start(() => linkRental(conversationId, rentalId));
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        disabled={pending}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Buscar reserva por cliente, patente u orden #…"
        className="h-10 w-full rounded-lg border border-foreground/15 bg-transparent px-3 text-sm outline-none focus:border-foreground/40"
      />
      {open && matches.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-foreground/10 bg-background py-1 shadow-lg">
          {matches.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => pick(o.id)}
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
