"use client";

import { useRef } from "react";

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
}: {
  existing: { posX: number; posY: number }[];
  markers: Marker[];
  onAdd: (posX: number, posY: number) => void;
  onRemove: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
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
      className="relative w-full cursor-crosshair select-none rounded-xl border border-foreground/15 bg-foreground/[0.02]"
      style={{ aspectRatio: "1 / 1.9" }}
    >
      <svg viewBox="0 0 100 190" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
        {/* carrocería */}
        <rect x="18" y="8" width="64" height="174" rx="26" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
        {/* parabrisas / luneta */}
        <path d="M26 46 Q50 34 74 46" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.2" />
        <path d="M26 150 Q50 162 74 150" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.2" />
        {/* techo */}
        <rect x="30" y="58" width="40" height="80" rx="12" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1" />
        {/* espejos */}
        <rect x="12" y="60" width="6" height="10" rx="2" fill="currentColor" fillOpacity="0.15" />
        <rect x="82" y="60" width="6" height="10" rx="2" fill="currentColor" fillOpacity="0.15" />
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
          onClick={() => onRemove(m.id)}
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
