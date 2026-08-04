"use client";

import { useState, useTransition } from "react";
import type { PaymentMethod, PaymentMethodOwnership } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  togglePaymentMethod,
  deletePaymentMethod,
  movePaymentMethod,
  updatePaymentMethods,
  type PaymentMethodUpdateInput,
} from "./actions";

type Draft = {
  name: string;
  adjustmentPercent: string;
  reference: string;
  ownership: PaymentMethodOwnership;
  requiresNote: boolean;
};

function draftFrom(it: PaymentMethod): Draft {
  return {
    name: it.name,
    adjustmentPercent: it.adjustmentPercent?.toString() ?? "",
    reference: it.reference ?? "",
    ownership: it.ownership,
    requiresNote: it.requiresNote,
  };
}

function draftsEqual(a: Draft, b: Draft): boolean {
  return (
    a.name === b.name &&
    a.adjustmentPercent === b.adjustmentPercent &&
    a.reference === b.reference &&
    a.ownership === b.ownership &&
    a.requiresNote === b.requiresNote
  );
}

/**
 * Edición de medios de pago con un único botón "Guardar cambios" para todas
 * las filas modificadas (en vez de un botón por medio de pago). Cada fila
 * mantiene un "draft" local; al guardar se manda un solo batch a
 * `updatePaymentMethods`. Subir/bajar/activar/borrar siguen siendo acciones
 * instantáneas por fila (no pasan por el draft).
 */
export function PaymentMethodsEditor({ items }: { items: PaymentMethod[] }) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(items.map((it) => [it.id, draftFrom(it)])),
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // `items` cambia de referencia solo cuando llegan datos frescos del server
  // (tras crear/activar/borrar/mover/guardar — revalidatePath re-renderiza el
  // padre). Ajustamos los drafts durante el render (patrón de React para
  // derivar estado de props) en vez de con un efecto: agrega drafts para
  // altas nuevas y descarta los de bajas, sin pisar ediciones en curso de
  // otras filas (activar/desactivar/mover no tocan estos campos).
  const [prevItems, setPrevItems] = useState(items);
  if (items !== prevItems) {
    setPrevItems(items);
    setDrafts((prev) => {
      const next: Record<string, Draft> = {};
      for (const it of items) {
        next[it.id] = prev[it.id] ?? draftFrom(it);
      }
      return next;
    });
  }

  const dirtyIds = items
    .filter((it) => drafts[it.id] && !draftsEqual(drafts[it.id], draftFrom(it)))
    .map((it) => it.id);
  const invalidIds = dirtyIds.filter((id) => drafts[id].name.trim() === "");

  function setField<K extends keyof Draft>(id: string, field: K, value: Draft[K]) {
    setError(null);
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  function handleSaveAll() {
    setError(null);
    const updates: PaymentMethodUpdateInput[] = dirtyIds.map((id) => ({ id, ...drafts[id] }));
    startTransition(async () => {
      try {
        await updatePaymentMethods(updates);
      } catch {
        setError("No se pudieron guardar los cambios. Probá de nuevo.");
      }
    });
  }

  const own = items.filter((it) => it.ownership === "own");
  const thirdParty = items.filter((it) => it.ownership === "third_party");

  return (
    <div className={`flex flex-col gap-4 ${dirtyIds.length > 0 ? "pb-16" : ""}`}>
      <PaymentMethodGroup title="Propias" items={own} drafts={drafts} setField={setField} />
      <PaymentMethodGroup
        title="Ajenas (Proveedores/Equipo)"
        items={thirdParty}
        drafts={drafts}
        setField={setField}
      />

      {dirtyIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-foreground/10 bg-background/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-lg flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-foreground/70">
              {dirtyIds.length} {dirtyIds.length === 1 ? "cambio sin guardar" : "cambios sin guardar"}
              {invalidIds.length > 0 && (
                <span className="ml-2 text-red-600">El nombre no puede quedar vacío</span>
              )}
            </span>
            <div className="flex items-center gap-3">
              {error && <span className="text-xs text-red-600">{error}</span>}
              <Button
                type="button"
                onClick={handleSaveAll}
                disabled={pending || invalidIds.length > 0}
                aria-busy={pending}
              >
                {pending ? "Guardando…" : "Guardar cambios"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentMethodGroup({
  title,
  items,
  drafts,
  setField,
}: {
  title: string;
  items: PaymentMethod[];
  drafts: Record<string, Draft>;
  setField: <K extends keyof Draft>(id: string, field: K, value: Draft[K]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/50">{title}</h3>
      {items.length === 0 ? (
        <p className="rounded-lg border border-foreground/10 px-3 py-2 text-sm text-foreground/50">
          Sin medios de pago en este grupo.
        </p>
      ) : (
        <ul className="mt-1 flex flex-col gap-3">
          {items.map((it, i) => {
            const draft = drafts[it.id];
            if (!draft) return null;
            return (
              <li key={it.id} className="flex flex-col gap-2 rounded-xl border border-foreground/10 p-3">
                <div className="flex items-center gap-2">
                  <div className="flex flex-col">
                    <form action={movePaymentMethod.bind(null, it.id, "up")}>
                      <button
                        disabled={i === 0}
                        className="px-1 text-xs text-foreground/50 disabled:opacity-30"
                        aria-label="Subir"
                      >
                        ▲
                      </button>
                    </form>
                    <form action={movePaymentMethod.bind(null, it.id, "down")}>
                      <button
                        disabled={i === items.length - 1}
                        className="px-1 text-xs text-foreground/50 disabled:opacity-30"
                        aria-label="Bajar"
                      >
                        ▼
                      </button>
                    </form>
                  </div>
                  <span className="flex-1 text-sm font-medium">{it.name}</span>
                  {draft.requiresNote && <Badge tone="orange">Requiere aclaración</Badge>}
                  {!it.active && <Badge tone="neutral">Inactivo</Badge>}
                  <form action={togglePaymentMethod.bind(null, it.id)}>
                    <button className="rounded-md px-2 py-1 text-xs font-medium text-foreground/60 hover:bg-foreground/5">
                      {it.active ? "Desactivar" : "Activar"}
                    </button>
                  </form>
                  <form action={deletePaymentMethod.bind(null, it.id)}>
                    <button className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-500/10">
                      Borrar
                    </button>
                  </form>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={draft.name}
                      onChange={(e) => setField(it.id, "name", e.target.value)}
                      className="h-10 rounded-lg border border-foreground/15 bg-transparent px-3 text-sm outline-none focus:border-foreground/40"
                    />
                    <input
                      value={draft.adjustmentPercent}
                      onChange={(e) => setField(it.id, "adjustmentPercent", e.target.value)}
                      type="text"
                      inputMode="decimal"
                      placeholder="% recargo/descuento"
                      className="h-10 rounded-lg border border-foreground/15 bg-transparent px-3 text-sm outline-none focus:border-foreground/40"
                    />
                  </div>
                  <textarea
                    value={draft.reference}
                    onChange={(e) => setField(it.id, "reference", e.target.value)}
                    rows={2}
                    placeholder="Referencia (alias/CVU) — interna"
                    className="rounded-lg border border-foreground/15 bg-transparent p-2 text-sm outline-none focus:border-foreground/40"
                  />
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-foreground/80">Cuenta</span>
                    <select
                      value={draft.ownership}
                      onChange={(e) => setField(it.id, "ownership", e.target.value as PaymentMethodOwnership)}
                      className="h-10 rounded-lg border border-foreground/15 bg-transparent px-3 text-sm outline-none focus:border-foreground/40"
                    >
                      <option value="own">Cuenta propia</option>
                      <option value="third_party">Cuenta ajena (proveedor/empleado)</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-foreground/80">
                    <input
                      type="checkbox"
                      checked={draft.requiresNote}
                      onChange={(e) => setField(it.id, "requiresNote", e.target.checked)}
                      className="h-4 w-4"
                    />
                    Requiere aclaración (a dónde fue el pago)
                  </label>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
