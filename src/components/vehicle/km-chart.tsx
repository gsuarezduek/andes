"use client";

import { useState } from "react";
import { formatDateTime } from "@/lib/datetime";

export type KmChartPoint = {
  id: string;
  km: number;
  createdAt: Date;
  type: "handover" | "return_";
  clientName: string;
  userName: string | null;
};

const MARGIN = { top: 14, right: 16, bottom: 30, left: 54 };
const POINT_SPACING = 56; // separación mínima entre puntos, en unidades del viewBox (~px)
const CHART_H = 200;

/** Ticks "redondos" (1/2/5 × 10^n) que cubren [min, max] — nunca números crudos. */
function niceTicks(min: number, max: number, count: number): number[] {
  if (min === max) return [min];
  const rawStep = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const residual = rawStep / magnitude;
  const niceResidual = residual > 5 ? 10 : residual > 2 ? 5 : residual > 1 ? 2 : 1;
  const step = niceResidual * magnitude;
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = niceMin; v <= niceMax + step / 2; v += step) ticks.push(Math.round(v));
  return ticks;
}

function shortDate(d: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Mendoza",
    day: "2-digit",
    month: "2-digit",
  }).format(d);
}

/** Gráfico SVG de evolución del kilometraje: referencias X/Y y detalle por punto (hover/tap). */
export function KmChart({ data }: { data: KmChartPoint[] }) {
  const [active, setActive] = useState<{ index: number; x: number; y: number } | null>(null);

  if (data.length < 2) {
    return (
      <p className="rounded-lg border border-foreground/10 px-4 py-3 text-sm text-foreground/50">
        Todavía no hay suficientes inspecciones para graficar el kilometraje.
      </p>
    );
  }

  const w = Math.max(320, MARGIN.left + MARGIN.right + (data.length - 1) * POINT_SPACING);
  const h = CHART_H;
  const innerW = w - MARGIN.left - MARGIN.right;
  const innerH = h - MARGIN.top - MARGIN.bottom;

  const kms = data.map((d) => d.km);
  const yTicks = niceTicks(Math.min(...kms), Math.max(...kms), 4);
  const domainMin = yTicks[0];
  const domainMax = yTicks[yTicks.length - 1];
  const domainRange = domainMax - domainMin || 1;

  const x = (i: number) => MARGIN.left + (data.length === 1 ? 0 : (i / (data.length - 1)) * innerW);
  const y = (km: number) => MARGIN.top + innerH - ((km - domainMin) / domainRange) * innerH;

  const linePoints = data.map((d, i) => `${x(i)},${y(d.km)}`).join(" ");
  const areaPoints = `${x(0)},${y(domainMin)} ${linePoints} ${x(data.length - 1)},${y(domainMin)}`;

  // Fechas en el eje X: todas si hay pocas, si no ~5 bien repartidas (siempre 1ra y última).
  const labelCount = Math.min(data.length, 6);
  const labelIndexes =
    data.length <= labelCount
      ? data.map((_, i) => i)
      : Array.from({ length: labelCount }, (_, k) => Math.round((k * (data.length - 1)) / (labelCount - 1)));

  const hovered = active ? data[active.index] : null;

  return (
    <div className="overflow-x-auto rounded-xl border border-foreground/10 p-3">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-[200px] w-full"
        style={{ minWidth: w > 560 ? w : undefined }}
        role="img"
        aria-label="Evolución del kilometraje"
        onClick={() => setActive(null)}
      >
        {/* Referencias Y: líneas horizontales + km, en valores redondos */}
        {yTicks.map((t) => (
          <g key={t}>
            <line
              x1={MARGIN.left}
              x2={w - MARGIN.right}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--foreground)"
              strokeOpacity="0.1"
              strokeWidth="1"
            />
            <text x={MARGIN.left - 8} y={y(t)} dy="3" fontSize="10" textAnchor="end" fill="var(--foreground)" fillOpacity="0.5">
              {t.toLocaleString("es-AR")}
            </text>
          </g>
        ))}

        {/* Referencias X: líneas verticales + fecha, en los puntos etiquetados */}
        {labelIndexes.map((i) => (
          <g key={i}>
            <line
              x1={x(i)}
              x2={x(i)}
              y1={MARGIN.top}
              y2={h - MARGIN.bottom}
              stroke="var(--foreground)"
              strokeOpacity="0.08"
              strokeWidth="1"
            />
            <text x={x(i)} y={h - MARGIN.bottom + 16} fontSize="10" textAnchor="middle" fill="var(--foreground)" fillOpacity="0.5">
              {shortDate(data[i].createdAt)}
            </text>
          </g>
        ))}

        {/* Crosshair del punto activo */}
        {active && (
          <line
            x1={x(active.index)}
            x2={x(active.index)}
            y1={MARGIN.top}
            y2={h - MARGIN.bottom}
            className="text-blue-600 dark:text-blue-400"
            stroke="currentColor"
            strokeOpacity="0.35"
            strokeWidth="1"
          />
        )}

        <g className="text-blue-600 dark:text-blue-400">
          <polygon points={areaPoints} fill="currentColor" fillOpacity="0.1" />
          <polyline points={linePoints} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {data.map((d, i) => {
            const isActive = active?.index === i;
            return (
              <g key={d.id}>
                <circle cx={x(i)} cy={y(d.km)} r={isActive ? 6 : 4} fill="currentColor" stroke="var(--background)" strokeWidth="2" />
                {/* Hit target ampliado (28px) para hover en desktop y tap en celular */}
                <circle
                  cx={x(i)}
                  cy={y(d.km)}
                  r="14"
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={(e) => {
                    e.stopPropagation();
                    setActive({ index: i, x: e.clientX, y: e.clientY });
                  }}
                  onMouseMove={(e) => {
                    e.stopPropagation();
                    setActive((a) => (a && a.index === i ? { ...a, x: e.clientX, y: e.clientY } : a));
                  }}
                  onMouseLeave={(e) => {
                    e.stopPropagation();
                    setActive(null);
                  }}
                  onClick={(e) => {
                    // En celular no hay hover: el tap es lo único que abre el
                    // detalle. Siempre lo (re)abre — cerrar es tocar afuera del
                    // punto (ver onClick del <svg>), no tocar el mismo de nuevo.
                    e.stopPropagation();
                    setActive({ index: i, x: e.clientX, y: e.clientY });
                  }}
                >
                  <title>
                    {(d.type === "handover" ? "Entrega" : "Devolución") +
                      ` · ${d.km.toLocaleString("es-AR")} km · ${formatDateTime(d.createdAt)}`}
                  </title>
                </circle>
              </g>
            );
          })}
        </g>
      </svg>

      {hovered && active && (
        <div
          className="pointer-events-none fixed z-50 w-64 rounded-lg border border-foreground/15 bg-background p-3 text-xs shadow-xl"
          style={{
            left: Math.min(active.x + 14, (typeof window !== "undefined" ? window.innerWidth : 9999) - 280),
            top: active.y + 18,
          }}
        >
          <p className="flex items-center gap-2 text-sm font-semibold">
            <span>{hovered.type === "handover" ? "Entrega" : "Devolución"}</span>
            <span className="font-normal text-foreground/50">{hovered.km.toLocaleString("es-AR")} km</span>
          </p>
          <p className="mt-0.5 text-foreground/60">{formatDateTime(hovered.createdAt)}</p>
          <p className="mt-1 text-foreground/80">{hovered.clientName}</p>
          <p className="text-foreground/50">Responsable: {hovered.userName ?? "—"}</p>
        </div>
      )}
    </div>
  );
}
