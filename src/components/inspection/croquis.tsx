"use client";

import { useRef } from "react";
import {
  CROQUIS_VIEWBOX,
  CROQUIS_BODY,
  CROQUIS_ROOF,
  CROQUIS_MIRRORS,
  CROQUIS_WINDSHIELD,
  CROQUIS_REAR_WINDOW,
} from "./croquis-shape";

export type Marker = { id: string; posX: number; posY: number };

/**
 * Croquis del auto (vista superior). Se toca para marcar un daño nuevo; los
 * daños ya registrados aparecen premarcados y no se pueden quitar acá.
 */
export function Croquis({
  existing,
  markers,
  onAdd,
  onRemove,
  readOnly = false,
}: {
  existing: { posX: number; posY: number }[];
  markers: Marker[];
  onAdd?: (posX: number, posY: number) => void;
  onRemove?: (id: string) => void;
  readOnly?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (readOnly || !onAdd) return;
    // Ignorar clicks sobre un marcador existente (los maneja su botón).
    if ((e.target as HTMLElement).dataset.marker) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const posX = (e.clientX - rect.left) / rect.width;
    const posY = (e.clientY - rect.top) / rect.height;
    onAdd(Math.min(1, Math.max(0, posX)), Math.min(1, Math.max(0, posY)));
  }

  return (
    <div
      ref={ref}
      onClick={handleClick}
      className={`relative w-full select-none rounded-xl border border-foreground/15 bg-foreground/[0.02] ${readOnly ? "" : "cursor-crosshair"}`}
      style={{ aspectRatio: "1 / 1.9" }}
    >
      <svg viewBox={`0 0 ${CROQUIS_VIEWBOX.width} ${CROQUIS_VIEWBOX.height}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
        {/* carrocería */}
        <rect {...CROQUIS_BODY} fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
        {/* parabrisas / luneta */}
        <path d={CROQUIS_WINDSHIELD} fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.2" />
        <path d={CROQUIS_REAR_WINDOW} fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.2" />
        {/* techo */}
        <rect {...CROQUIS_ROOF} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1" />
        {/* espejos */}
        {CROQUIS_MIRRORS.map((m, i) => (
          <rect key={i} {...m} fill="currentColor" fillOpacity="0.15" />
        ))}
        <text x="50" y="26" textAnchor="middle" fontSize="7" fill="currentColor" fillOpacity="0.4">Frente</text>
        <text x="50" y="176" textAnchor="middle" fontSize="7" fill="currentColor" fillOpacity="0.4">Atrás</text>
      </svg>

      {existing.map((d, i) => (
        <span
          key={`e-${i}`}
          className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-amber-500 shadow"
          style={{ left: `${d.posX * 100}%`, top: `${d.posY * 100}%` }}
          title="Daño existente"
        />
      ))}

      {markers.map((m) => (
        <button
          key={m.id}
          type="button"
          data-marker="1"
          onClick={() => onRemove?.(m.id)}
          className="absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-red-600 text-[10px] font-bold text-white shadow"
          style={{ left: `${m.posX * 100}%`, top: `${m.posY * 100}%` }}
          title="Tocar para quitar"
        >
          ✕
        </button>
      ))}
    </div>
  );
}
