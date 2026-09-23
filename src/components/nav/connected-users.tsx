"use client";

import { useEffect, useState } from "react";
import type { OnlineUser } from "@/lib/presence";

const POLL_MS = 2 * 60_000;

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

/**
 * Quién está usando Andes ahora mismo (incluido quien mira la lista). Este
 * polling cada 2 minutos
 * (pausado con la pestaña en segundo plano, mismo criterio que `AutoRefresh`)
 * es también el heartbeat real de presencia propia: `GET /api/presence` marca
 * "visto" a quien pregunta, además de devolver la lista. Hace falta porque el
 * layout autenticado (`touchPresence` en `(app)/layout.tsx`) solo cubre
 * login/F5 — por Partial Rendering, no se re-ejecuta al navegar entre rutas
 * que lo comparten, que es como se usa la app normalmente.
 */
export function ConnectedUsers({ initialUsers }: { initialUsers: OnlineUser[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/presence", { cache: "no-store" });
        if (res.ok) setUsers(await res.json());
      } catch {
        // best-effort, se reintenta en el próximo tick
      }
    };
    const interval = window.setInterval(tick, POLL_MS);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Usuarios conectados"
        title={users.length === 0 ? "Nadie más conectado" : `Conectados: ${users.map((u) => u.name).join(", ")}`}
        className="flex h-9 items-center rounded-lg px-2 text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
      >
        <div className="flex -space-x-2">
          {users.length === 0 ? (
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-foreground/20 text-[10px] text-foreground/30">
              —
            </span>
          ) : (
            users
              .slice(0, 4)
              .map((u) => (
                <span
                  key={u.id}
                  className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-emerald-500/15 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400"
                >
                  {initials(u.name)}
                </span>
              ))
          )}
        </div>
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div
            role="menu"
            className="absolute right-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-xl border border-foreground/10 bg-background py-1 shadow-lg"
          >
            <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-foreground/40">
              {users.length === 0 ? "Nadie más conectado" : "Conectados ahora"}
            </div>
            {users.map((u) => (
              <div key={u.id} className="flex items-center gap-2 px-4 py-2 text-sm text-foreground/80">
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                <span className="truncate">{u.name}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
