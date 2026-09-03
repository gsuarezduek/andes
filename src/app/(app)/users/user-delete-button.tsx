"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { deleteUser } from "./actions";

export function UserDeleteButton({
  userId,
  name,
  active,
}: {
  userId: string;
  name: string;
  active: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      try {
        await deleteUser(userId);
      } catch (err) {
        unstable_rethrow(err);
        setConfirming(false);
        setError(err instanceof Error ? err.message : "No se pudo borrar.");
      }
    });
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
        <p className="text-sm text-red-700 dark:text-red-400">
          ¿Borrar a &quot;{name}&quot;? No se puede deshacer.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="text-xs text-foreground/50"
            disabled={pending}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
          >
            {pending ? "Borrando…" : "Sí, borrar"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 border-t border-foreground/10 pt-4">
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={active}
        className="self-start rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Borrar usuario
      </button>
      {active && (
        <p className="text-xs text-foreground/50">
          Desactivalo primero (más arriba) para poder borrarlo.
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
