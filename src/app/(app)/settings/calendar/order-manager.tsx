"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { saveCalendarOrder } from "../actions";

export type OrderRow = { id: string; label: string; rateLabel: string };

/**
 * Gestión del orden de los autos en el calendario. Se reordena con ↑/↓ y se
 * guarda como `sortOrder = posición`. La tarifa se muestra como referencia para
 * ordenar del más caro al más económico.
 */
export function OrderManager({ initial }: { initial: OrderRow[] }) {
  const [rows, setRows] = useState<OrderRow[]>(initial);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  const dirty = rows.some((r, i) => r.id !== initial[i]?.id);

  function move(index: number, dir: -1 | 1) {
    const to = index + dir;
    if (to < 0 || to >= rows.length) return;
    setRows((prev) => {
      const next = [...prev];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
    setSaved(false);
  }

  function save() {
    start(async () => {
      const res = await saveCalendarOrder(rows.map((r) => r.id));
      if (res.ok) {
        setSaved(true);
        router.refresh();
      }
    });
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-foreground/10 px-4 py-3 text-sm text-foreground/50">
        No hay autos en la flota operativa.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
        {rows.map((r, i) => (
          <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
            <span className="w-6 shrink-0 text-right text-sm tabular-nums text-foreground/40">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{r.label}</p>
              <p className="truncate text-xs text-foreground/50">{r.rateLabel}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label="Subir"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-foreground/15 text-foreground/70 transition-colors hover:bg-foreground/5 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === rows.length - 1}
                aria-label="Bajar"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-foreground/15 text-foreground/70 transition-colors hover:bg-foreground/5 disabled:opacity-30"
              >
                ↓
              </button>
            </div>
          </li>
        ))}
      </ol>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={save} disabled={!dirty || pending}>
          {pending ? "Guardando…" : "Guardar orden"}
        </Button>
        {saved && !dirty && (
          <span className="text-sm font-medium text-emerald-600">Orden guardado ✓</span>
        )}
        {dirty && !pending && (
          <span className="text-sm text-amber-600">Cambios sin guardar</span>
        )}
      </div>
    </div>
  );
}
