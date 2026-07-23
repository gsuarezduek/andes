"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/** Botón-ícono para disparar la sincronización con VikRentCar a mano. */
export function SyncButton({ sync, full = false }: { sync: () => Promise<void>; full?: boolean }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const router = useRouter();
  const run = () =>
    start(async () => {
      setDone(false);
      try {
        await sync();
        setDone(true);
        router.refresh();
      } catch {
        /* sin feedback de error acá; el detalle está en /sync */
      }
    });

  if (full) {
    return (
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-base font-medium text-foreground/70 transition-colors hover:bg-foreground/5 disabled:opacity-60"
      >
        <SyncIcon spinning={pending} done={done} />
        {pending ? "Sincronizando…" : done ? "Sincronizado ✓" : "Sincronizar ahora"}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      title={pending ? "Sincronizando…" : done ? "Sincronizado" : "Sincronizar ahora"}
      aria-label="Sincronizar ahora"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground disabled:opacity-60"
    >
      <SyncIcon spinning={pending} done={done} />
    </button>
  );
}

function SyncIcon({ spinning, done }: { spinning: boolean; done: boolean }) {
  if (done && !spinning) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-emerald-600">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={spinning ? "animate-spin" : ""}>
      <path d="M21 12a9 9 0 0 1-9 9c-2.5 0-4.8-1-6.4-2.7" />
      <path d="M3 12a9 9 0 0 1 9-9c2.5 0 4.8 1 6.4 2.7" />
      <polyline points="21 3 21 8 16 8" />
      <polyline points="3 21 3 16 8 16" />
    </svg>
  );
}
