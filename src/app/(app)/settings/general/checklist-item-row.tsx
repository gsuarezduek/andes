"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { toggleChecklistItem, deleteChecklistItem, moveChecklistItem } from "../../checklist/actions";

type ChecklistItem = { id: string; label: string; active: boolean };

export function ChecklistItemRow({
  item,
  isFirst,
  isLast,
}: {
  item: ChecklistItem;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();

  function handleDelete() {
    setError(null);
    startDelete(async () => {
      try {
        await deleteChecklistItem(item.id);
      } catch (err) {
        unstable_rethrow(err);
        setConfirmDelete(false);
        setError(err instanceof Error ? err.message : "No se pudo borrar.");
      }
    });
  }

  if (confirmDelete) {
    return (
      <li className="flex items-center justify-between gap-3 bg-red-500/5 px-3 py-2">
        <span className="text-sm text-red-700 dark:text-red-400">
          ¿Borrar &quot;{item.label}&quot;? No se puede deshacer.
        </span>
        <div className="flex shrink-0 items-center gap-3">
          <button type="button" onClick={() => setConfirmDelete(false)} className="text-xs text-foreground/50" disabled={deleting}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60"
          >
            {deleting ? "Borrando…" : "Sí, borrar"}
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-1 px-3 py-2">
      <div className="flex items-center gap-2">
        <div className="flex flex-col">
          <form action={moveChecklistItem.bind(null, item.id, "up")}>
            <button disabled={isFirst} className="px-1 text-xs text-foreground/50 disabled:opacity-30" aria-label="Subir">▲</button>
          </form>
          <form action={moveChecklistItem.bind(null, item.id, "down")}>
            <button disabled={isLast} className="px-1 text-xs text-foreground/50 disabled:opacity-30" aria-label="Bajar">▼</button>
          </form>
        </div>
        <span className={`flex-1 text-sm ${item.active ? "" : "text-foreground/40 line-through"}`}>
          {item.label}
        </span>
        {!item.active && <Badge tone="neutral">Inactivo</Badge>}
        <form action={toggleChecklistItem.bind(null, item.id)}>
          <button className="rounded-md px-2 py-1 text-xs font-medium text-foreground/60 hover:bg-foreground/5">
            {item.active ? "Desactivar" : "Activar"}
          </button>
        </form>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-500/10"
        >
          Borrar
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </li>
  );
}
