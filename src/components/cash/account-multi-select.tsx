"use client";

import { useEffect, useRef, useState } from "react";
import { groupSubaccounts } from "@/lib/subaccount-order";
import type { PaymentMethodOption } from "./cash-movements-board";

const GROUPS = [
  { ownership: "own", label: "Propias" },
  { ownership: "associate", label: "Asociados" },
  { ownership: "provider", label: "Proveedores" },
  { ownership: "misc", label: "Varios" },
] as const;

/**
 * Lista de casillas de cuentas agrupada por tipo (Propias/Asociados/…), con
 * las subcuentas debajo de su principal. Marcar una principal deja marcadas
 * (y fijas) sus subcuentas: el filtro ya las incluye (`expandAccountIds`).
 * Sin ninguna marcada = todas. La comparten el filtro de Movimientos
 * (`AccountMultiSelect`) y el modal de "Exportar CSV".
 */
export function AccountCheckboxList({
  paymentMethods,
  value,
  onChange,
  className = "max-h-60",
}: {
  paymentMethods: PaymentMethodOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  className?: string;
}) {
  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  }
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={value.length === 0} onChange={() => onChange([])} className="h-4 w-4" />
        Todas las cuentas
      </label>
      <div className={`flex flex-col gap-3 overflow-y-auto rounded-lg border border-foreground/10 p-3 ${className}`}>
        {GROUPS.map((g) => {
          const methods = paymentMethods.filter((m) => m.ownership === g.ownership);
          if (methods.length === 0) return null;
          return (
            <div key={g.ownership} className="flex flex-col gap-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">{g.label}</p>
              {groupSubaccounts(methods).map(({ item, isChild }) => {
                const parentChecked = isChild && !!item.parentId && value.includes(item.parentId);
                return (
                  <label key={item.id} className={`flex items-center gap-2 ${isChild ? "ml-5" : ""}`}>
                    <input
                      type="checkbox"
                      checked={parentChecked || value.includes(item.id)}
                      disabled={parentChecked}
                      onChange={() => toggle(item.id)}
                      className="h-4 w-4"
                    />
                    {isChild && <span className="text-foreground/40">↳</span>}
                    {item.name}
                  </label>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Texto del botón: "Todas las cuentas", el nombre si es una, o "Efectivo + 2 más". */
export function accountSelectionLabel(ids: string[], paymentMethods: PaymentMethodOption[]): string {
  const names = ids.map((id) => paymentMethods.find((m) => m.id === id)?.name).filter(Boolean) as string[];
  if (names.length === 0) return "Todas las cuentas";
  if (names.length === 1) return names[0];
  return `${names[0]} + ${names.length - 1} más`;
}

/**
 * Filtro de cuenta de Movimientos: un botón con la selección actual que abre
 * un desplegable con casillas (una, dos o más cuentas a la vez). Se cierra
 * tocando afuera o con Escape.
 */
export function AccountMultiSelect({
  paymentMethods,
  value,
  onChange,
}: {
  paymentMethods: PaymentMethodOption[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground/80">Cuentas</span>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-11 w-56 items-center justify-between gap-2 rounded-lg border bg-transparent px-3 text-left text-sm outline-none focus:border-foreground/40 ${
          value.length > 0 ? "border-foreground/40 font-medium" : "border-foreground/15"
        }`}
      >
        <span className="truncate">{accountSelectionLabel(value, paymentMethods)}</span>
        <span aria-hidden className="text-foreground/40">
          ▾
        </span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-72 rounded-xl border border-foreground/15 bg-background p-3 shadow-lg">
          <AccountCheckboxList paymentMethods={paymentMethods} value={value} onChange={onChange} className="max-h-72" />
          <p className="mt-2 text-xs text-foreground/50">Podés marcar varias. Una cuenta principal incluye sus subcuentas.</p>
        </div>
      )}
    </div>
  );
}
