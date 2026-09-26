"use client";

import { useState, type ReactNode } from "react";

/**
 * Cabecera de la página de WhatsApp: el título a la izquierda y, en el espacio
 * libre de la derecha, el switch de "Bot de IA" con el toggle de
 * "Entrenamiento y configuración". El panel expandido se abre debajo, a ancho
 * completo (los formularios necesitan el espacio). En pantallas angostas la
 * fila del bot pasa debajo del título.
 */
export function BotTrainingPanel({
  title,
  globalToggle,
  children,
}: {
  title: ReactNode;
  globalToggle: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        {title}
        <div className="flex items-center gap-3 rounded-xl border border-foreground/10 px-4 py-2.5">
          <span className="text-sm font-medium">🤖 Bot de IA</span>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="text-xs font-medium text-foreground/60 hover:text-foreground"
          >
            Entrenamiento y configuración {open ? "▴" : "▾"}
          </button>
          {globalToggle}
        </div>
      </div>
      {open ? <section className="rounded-xl border border-foreground/10 p-4">{children}</section> : null}
    </div>
  );
}
