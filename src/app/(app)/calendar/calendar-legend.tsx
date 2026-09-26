"use client";

import { useState } from "react";
import { VerifiedIcon } from "@/components/ui/icons";

/**
 * Guía de colores de las barras del Calendario. En desktop queda siempre
 * visible; en mobile ocupaba varias líneas, así que se colapsa detrás de un
 * solo botón "Colores".
 */
export function CalendarLegend({ showRooms }: { showRooms: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="text-xs text-foreground/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-foreground/15 px-2.5 font-medium sm:hidden"
      >
        <span className="flex -space-x-1" aria-hidden>
          <span className="size-2.5 rounded-full bg-emerald-600 ring-1 ring-background" />
          <span className="size-2.5 rounded-full bg-amber-400 ring-1 ring-background" />
          <span className="size-2.5 rounded-full bg-orange-500 ring-1 ring-background" />
        </span>
        Colores
        <span aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
      <div className={`${open ? "flex" : "hidden"} mt-2 flex-wrap items-center gap-x-4 gap-y-1.5 sm:mt-0 sm:flex`}>
        <Item swatch={<span className="inline-block h-3 w-3 rounded bg-emerald-600/90" />} label="Activo" />
        <Item swatch={<span className="inline-block h-3 w-3 rounded bg-amber-400" />} label="Confirmado (pagado)" />
        <Item swatch={<span className="inline-block h-3 w-3 rounded bg-orange-500" />} label="Pendiente" />
        <Item swatch={<span className="inline-block h-3 w-3 rounded bg-red-600/90" />} label="Cancelado" />
        <Item swatch={<span className="inline-block h-3 w-3 rounded bg-slate-400/90" />} label="Finalizado" />
        <Item swatch={<span className="inline-block h-3 w-3 rounded bg-blue-600/90" />} label="En service" />
        <Item
          swatch={<span className="inline-block h-3 w-3 rounded border border-blue-600/30 bg-blue-600/10" />}
          label="Fuera de servicio (fila)"
        />
        <Item
          swatch={
            <span className="inline-flex size-4 items-center justify-center rounded-full bg-white text-emerald-700 ring-1 ring-emerald-700/40">
              <VerifiedIcon className="size-2.5" />
            </span>
          }
          label="Verificada por un admin"
        />
        <Item swatch={<span className="inline-block h-1.5 w-3 rounded-full bg-purple-500" />} label="Temporada con aumento (día)" />
        <Item
          swatch={<span className="inline-block h-3 w-3 rounded border-2 border-dashed border-orange-500 bg-orange-500/20" />}
          label="Presupuesto (borrador)"
        />
        {showRooms ? (
          <>
            <Item swatch={<span className="inline-block h-3 w-3 rounded bg-pink-500" />} label="Airbnb" />
            <Item swatch={<span className="inline-block h-3 w-3 rounded bg-indigo-600" />} label="Booking" />
            <Item swatch={<span className="inline-block h-3 w-3 rounded bg-teal-600" />} label="Habitación directa" />
            <Item swatch={<span className="inline-block h-3 w-3 rounded bg-slate-500/70" />} label="Bloqueo" />
          </>
        ) : null}
      </div>
    </div>
  );
}

function Item({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      {swatch} {label}
    </span>
  );
}
