"use client";

import { useEffect, useRef, useState } from "react";
import { addDaysYmd } from "@/lib/cash-period";
import { formatMoney } from "@/lib/contract";
import type { Currency } from "@/lib/currency";
import type { BalanceHistoryGranularity, BalancePoint } from "@/lib/balance-history";

const MARGIN = { top: 14, right: 16, bottom: 26, left: 72 };
const POINT_SPACING = 10; // separación mínima entre puntos, en unidades del viewBox (~px)
const CHART_H = 180;

/** Ticks "redondos" (1/2/5 × 10^n) que cubren [min, max] — nunca números crudos. Soporta rango negativo (saldo en descubierto). */
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

function shortLabel(ymd: string): string {
  const [, m, d] = ymd.split("-");
  return `${d}/${m}`;
}

type SeriesChartProps = {
  points: BalancePoint[];
  currency: Currency;
  granularity: BalanceHistoryGranularity;
  colorClassName: string;
  title: string;
};

function CurrencyLineChart({ points, currency, granularity, colorClassName, title }: SeriesChartProps) {
  const [active, setActive] = useState<{ index: number; x: number; y: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [points.length]);

  const values = points.map((p) => (currency === "ars" ? p.ars : p.usd));
  const w = Math.max(320, MARGIN.left + MARGIN.right + (points.length - 1) * POINT_SPACING);
  const h = CHART_H;
  const innerW = w - MARGIN.left - MARGIN.right;
  const innerH = h - MARGIN.top - MARGIN.bottom;

  const yTicks = niceTicks(Math.min(...values), Math.max(...values), 4);
  const domainMin = yTicks[0];
  const domainMax = yTicks[yTicks.length - 1];
  const domainRange = domainMax - domainMin || 1;

  const x = (i: number) => MARGIN.left + (points.length === 1 ? 0 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => MARGIN.top + innerH - ((v - domainMin) / domainRange) * innerH;

  const linePoints = points.map((p, i) => `${x(i)},${y(values[i])}`).join(" ");
  const areaPoints = `${x(0)},${y(domainMin)} ${linePoints} ${x(points.length - 1)},${y(domainMin)}`;

  // Etiquetas en el eje X: todas si hay pocas, si no ~6 bien repartidas (siempre la 1ra y la última).
  const labelCount = Math.min(points.length, 6);
  const labelIndexes =
    points.length <= labelCount
      ? points.map((_, i) => i)
      : Array.from({ length: labelCount }, (_, k) => Math.round((k * (points.length - 1)) / (labelCount - 1)));

  const hovered = active ? points[active.index] : null;
  const hoveredValue = hovered ? (currency === "ars" ? hovered.ars : hovered.usd) : null;

  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-medium text-foreground/70">{title}</p>
      <div ref={scrollRef} className="overflow-x-auto rounded-xl border border-foreground/10 p-3">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="h-[180px] w-full"
          style={{ minWidth: w > 560 ? w : undefined }}
          role="img"
          aria-label={title}
          onClick={() => setActive(null)}
        >
          {yTicks.map((t) => (
            <g key={t}>
              <line
                x1={MARGIN.left}
                x2={w - MARGIN.right}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--foreground)"
                strokeOpacity={t === 0 ? 0.22 : 0.1}
                strokeWidth="1"
              />
              <text x={MARGIN.left - 8} y={y(t)} dy="3" fontSize="10" textAnchor="end" fill="var(--foreground)" fillOpacity="0.5">
                {formatMoney(t, currency)}
              </text>
            </g>
          ))}

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
                {shortLabel(points[i].date)}
              </text>
            </g>
          ))}

          {active && (
            <line
              x1={x(active.index)}
              x2={x(active.index)}
              y1={MARGIN.top}
              y2={h - MARGIN.bottom}
              className={colorClassName}
              stroke="currentColor"
              strokeOpacity="0.35"
              strokeWidth="1"
            />
          )}

          <g className={colorClassName}>
            <polygon points={areaPoints} fill="currentColor" fillOpacity="0.1" />
            <polyline points={linePoints} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {points.map((p, i) => {
              const isActive = active?.index === i;
              return (
                <g key={p.date}>
                  {isActive && (
                    <circle cx={x(i)} cy={y(values[i])} r="6" fill="currentColor" stroke="var(--background)" strokeWidth="2" />
                  )}
                  {/* Hit target ampliado para hover en desktop y tap en celular */}
                  <circle
                    cx={x(i)}
                    cy={y(values[i])}
                    r={Math.max(8, POINT_SPACING / 2)}
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
                      e.stopPropagation();
                      setActive({ index: i, x: e.clientX, y: e.clientY });
                    }}
                  >
                    <title>
                      {(granularity === "weekly" ? `Semana del ${shortLabel(p.date)}` : shortLabel(p.date)) +
                        ` · ${formatMoney(values[i], currency)}`}
                    </title>
                  </circle>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {hovered && active && hoveredValue != null && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg border border-foreground/15 bg-background px-3 py-2 text-xs shadow-xl"
          style={{
            left: Math.min(active.x + 14, (typeof window !== "undefined" ? window.innerWidth : 9999) - 220),
            top: active.y + 18,
          }}
        >
          <p className="font-semibold">{formatMoney(hoveredValue, currency)}</p>
          <p className="text-foreground/60">
            {granularity === "weekly"
              ? `Semana del ${shortLabel(hovered.date)} al ${shortLabel(addDaysYmd(hovered.date, 6))}`
              : shortLabel(hovered.date)}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Evolución del saldo de una cuenta — una línea por moneda con actividad
 * (ARS siempre; USD solo si la cuenta tuvo algún movimiento en dólares).
 * Reconstruida en el servidor (`getOwnAccountBalanceHistory`), acá solo se
 * dibuja. Dos monedas nunca comparten eje (ver skill de dataviz: nunca un
 * gráfico de doble eje) — si hace falta mostrar las dos, son dos gráficos.
 */
export function BalanceHistoryChart({
  points,
  granularity,
}: {
  points: BalancePoint[];
  granularity: BalanceHistoryGranularity;
}) {
  if (points.length === 0) {
    return (
      <p className="rounded-lg border border-foreground/10 px-4 py-3 text-sm text-foreground/50">
        Todavía no hay movimientos en este período para graficar.
      </p>
    );
  }

  const hasUsd = points.some((p) => p.usd !== 0);

  return (
    <div className="flex flex-col gap-4">
      <CurrencyLineChart
        points={points}
        currency="ars"
        granularity={granularity}
        colorClassName="text-blue-600 dark:text-blue-400"
        title={hasUsd ? "Saldo en pesos (ARS)" : "Saldo"}
      />
      {hasUsd && (
        <CurrencyLineChart
          points={points}
          currency="usd"
          granularity={granularity}
          colorClassName="text-violet-600 dark:text-violet-400"
          title="Saldo en dólares (USD)"
        />
      )}
    </div>
  );
}
