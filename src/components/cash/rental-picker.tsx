"use client";

import { useMemo, useState } from "react";
import type { RentalPickerOption } from "@/lib/cash";

const MAX_MATCHES = 8;

export function RentalPicker({ options }: { options: RentalPickerOption[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<RentalPickerOption | null>(null);
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return options
      .filter(
        (o) =>
          o.clientName.toLowerCase().includes(q) ||
          (o.bookingId?.includes(q) ?? false) ||
          (o.vehicleName?.toLowerCase().includes(q) ?? false),
      )
      .slice(0, MAX_MATCHES);
  }, [query, options]);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground/80">Reserva (opcional)</span>
      <input type="hidden" name="rentalId" value={selected?.id ?? ""} />
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
            placeholder="Cliente, auto o N° de reserva…"
            className="h-11 w-full rounded-lg border border-foreground/15 bg-transparent px-3 text-base outline-none focus:border-foreground/40"
          />
          {open && matches.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-foreground/10 bg-background py-1 shadow-lg">
              {matches.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(o);
                      setQuery("");
                      setOpen(false);
                    }}
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
      )}
    </div>
  );
}
