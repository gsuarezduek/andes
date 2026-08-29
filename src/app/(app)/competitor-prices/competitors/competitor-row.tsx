"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import type { Competitor } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toggleCompetitorActive, deleteCompetitor } from "../actions";

export function CompetitorRow({ competitor: c }: { competitor: Competitor }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();

  function handleDelete() {
    setError(null);
    startDelete(async () => {
      try {
        await deleteCompetitor(c.id);
      } catch (err) {
        unstable_rethrow(err);
        setConfirmDelete(false);
        setError(err instanceof Error ? err.message : "No se pudo borrar.");
      }
    });
  }

  if (confirmDelete) {
    return (
      <li className="flex items-center justify-between gap-3 bg-red-500/5 px-4 py-3">
        <span className="text-sm text-red-700 dark:text-red-400">
          ¿Borrar &quot;{c.name}&quot; y todo su historial de precios? No se puede deshacer.
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
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div>
        <p className="flex items-center gap-2 text-sm font-medium">
          {c.name}
          <Badge tone={c.active ? "emerald" : "neutral"}>{c.active ? "activo" : "inactivo"}</Badge>
        </p>
        <p className="text-xs text-foreground/50">
          {c.url} · adaptador: <code>{c.adapterKey}</code>
        </p>
        {c.notes ? <p className="mt-1 text-xs text-foreground/60">{c.notes}</p> : null}
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <form action={toggleCompetitorActive.bind(null, c.id)}>
          <Button type="submit" variant="secondary">
            {c.active ? "Desactivar" : "Reactivar"}
          </Button>
        </form>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="rounded-md px-2.5 py-2 text-xs font-medium text-red-600 hover:bg-red-500/10"
        >
          Borrar
        </button>
      </div>
    </li>
  );
}
