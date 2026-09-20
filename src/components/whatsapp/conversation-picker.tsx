"use client";

import { useMemo, useState } from "react";
import type { ConversationPickerOption } from "@/lib/rental-quotes";

const MAX_MATCHES = 8;

/**
 * Buscador para vincular (opcionalmente) una conversación de WhatsApp a un
 * presupuesto del Calendario — mismo patrón que `RentalLinkPicker`
 * (src/components/whatsapp/rental-link-picker.tsx), pero no llama a ningún
 * server action: solo reporta la elección al padre (`onPick`), que la manda
 * junto al resto del formulario.
 */
export function ConversationPicker({
  options,
  selected,
  onPick,
}: {
  options: ConversationPickerOption[];
  selected: ConversationPickerOption | null;
  onPick: (option: ConversationPickerOption | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return options
      .filter((o) => o.phoneE164.includes(q) || (o.customerName?.toLowerCase().includes(q) ?? false))
      .slice(0, MAX_MATCHES);
  }, [query, options]);

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-foreground/15 px-3 py-2 text-sm">
        <span className="truncate">🔗 {selected.label}</span>
        <button
          type="button"
          onClick={() => onPick(null)}
          className="shrink-0 text-xs font-medium text-foreground/50 hover:text-foreground/80"
        >
          Quitar
        </button>
      </div>
    );
  }

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
        placeholder="Buscar conversación por nombre o teléfono…"
        className="h-10 w-full rounded-lg border border-foreground/15 bg-transparent px-3 text-sm outline-none focus:border-foreground/40"
      />
      {open && matches.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-foreground/10 bg-background py-1 shadow-lg">
          {matches.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(o);
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
  );
}
