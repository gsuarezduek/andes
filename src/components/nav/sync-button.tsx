"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type SyncOutcome = { result: "success" | "partial" | "error"; message?: string };

/** Botón-ícono para disparar la sincronización con VikRentCar a mano. */
export function SyncButton({ sync, full = false }: { sync: () => Promise<SyncOutcome>; full?: boolean }) {
  const [pending, start] = useTransition();
  const [outcome, setOutcome] = useState<SyncOutcome | null>(null);
  const router = useRouter();
  const run = () =>
    start(async () => {
      setOutcome(null);
      try {
        const result = await sync();
        setOutcome(result);
        router.refresh();
      } catch {
        setOutcome({ result: "error", message: "No se pudo sincronizar." });
      }
    });

  const label = pending
    ? "Sincronizando…"
    : outcome?.result === "error"
      ? (outcome.message ?? "No se pudo sincronizar")
      : outcome?.result === "partial"
        ? "Sincronizado con errores parciales (ver /sync)"
        : outcome?.result === "success"
          ? "Sincronizado ✓"
          : "Sincronizar ahora";

  if (full) {
    return (
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-base font-medium text-foreground/70 transition-colors hover:bg-foreground/5 disabled:opacity-60"
      >
        <SyncIcon spinning={pending} outcome={outcome} />
        {label}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      title={label}
      aria-label="Sincronizar ahora"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground disabled:opacity-60"
    >
      <SyncIcon spinning={pending} outcome={outcome} />
    </button>
  );
}

function SyncIcon({ spinning, outcome }: { spinning: boolean; outcome: SyncOutcome | null }) {
  if (!spinning && outcome?.result === "success") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-emerald-600">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  if (!spinning && outcome?.result === "partial") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-amber-600">
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      </svg>
    );
  }
  if (!spinning && outcome?.result === "error") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-red-600">
        <circle cx="12" cy="12" r="10" />
        <path d="m15 9-6 6" />
        <path d="m9 9 6 6" />
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
