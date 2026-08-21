"use client";

import { useMemo, useState } from "react";

const MAX_MATCHES = 20;

export type PaymentMethodPickerOption = { id: string; name: string };

/**
 * Selector de medio de pago con búsqueda en vivo (escribís y filtra), en vez
 * de un `<select>` con todas las opciones — pensado para cuando la lista de
 * medios de pago crece (proveedores, cuentas de equipo, etc.). Mismo patrón
 * que `RentalPicker`: elegido → chip con "Cambiar"; sin elegir → input +
 * lista de coincidencias.
 *
 * No impone `required` nativo (el input real que viaja en el form es un
 * `<input type="hidden">`) — si el campo es obligatorio, el caller debe
 * deshabilitar su propio botón de submit mientras `value` esté vacío.
 */
export function PaymentMethodPicker<T extends PaymentMethodPickerOption>({
  id,
  name,
  label,
  hint,
  options,
  value,
  onChange,
  placeholder = "Buscar medio de pago…",
  formatOption,
}: {
  id: string;
  name?: string;
  label: string;
  hint?: string;
  options: T[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  /** Cómo mostrar cada opción (default: solo el nombre) — ej. sumar el % de recargo. */
  formatOption?: (option: T) => string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);
  const display = (o: T) => (formatOption ? formatOption(o) : o.name);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;
    return pool.slice(0, MAX_MATCHES);
  }, [query, options]);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground/80">{label}</span>
      <input type="hidden" name={name ?? id} value={value} />
      {selected ? (
        <div className="flex h-11 items-center justify-between gap-2 rounded-lg border border-foreground/15 px-3 text-base">
          <span className="min-w-0 truncate">{display(selected)}</span>
          <button
            type="button"
            onClick={() => {
              onChange("");
              setQuery("");
            }}
            className="shrink-0 text-xs text-foreground/50"
          >
            Cambiar
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            id={id}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder={placeholder}
            className="h-11 w-full rounded-lg border border-foreground/15 bg-transparent px-3 text-base outline-none focus:border-foreground/40"
          />
          {open && matches.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-foreground/10 bg-background py-1 shadow-lg">
              {matches.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(o.id);
                      setQuery("");
                      setOpen(false);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-foreground/5"
                  >
                    {display(o)}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {open && matches.length === 0 && (
            <p className="absolute z-20 mt-1 w-full rounded-lg border border-foreground/10 bg-background px-3 py-2 text-sm text-foreground/50 shadow-lg">
              Sin coincidencias.
            </p>
          )}
        </div>
      )}
      {hint && <span className="text-xs text-foreground/50">{hint}</span>}
    </div>
  );
}
