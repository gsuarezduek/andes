"use client";

import { useState, type ReactNode } from "react";

/**
 * Header con el switch de "Bot de IA" y, en la misma fila, el toggle de
 * "Entrenamiento y configuración" — antes era un <details> aparte, debajo del
 * header, lejos del switch de encendido/apagado.
 */
export function BotTrainingPanel({ globalToggle, children }: { globalToggle: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-xl border border-foreground/10">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <span className="text-sm font-medium">🤖 Bot de IA</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="text-xs font-medium text-foreground/60 hover:text-foreground"
          >
            Entrenamiento y configuración {open ? "▴" : "▾"}
          </button>
          {globalToggle}
        </div>
      </div>
      {open ? <div className="border-t border-foreground/10 p-4">{children}</div> : null}
    </section>
  );
}
