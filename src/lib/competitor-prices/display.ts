import type { CompetitorPriceStatus } from "@prisma/client";
import type { BadgeTone } from "@/lib/rental-ui";

/** Etiqueta + tono de badge para el estado de confiabilidad de un precio de competencia (mismo patrón que `rentalStatusDisplay`). */
export function priceCheckStatusDisplay(status: CompetitorPriceStatus): { label: string; tone: BadgeTone } {
  switch (status) {
    case "verified":
      return { label: "Verificado", tone: "emerald" };
    case "auto_found":
      return { label: "Encontrado automático", tone: "blue" };
    case "needs_review":
      return { label: "Requiere revisión", tone: "amber" };
    case "unavailable":
      return { label: "No disponible", tone: "neutral" };
  }
}

/**
 * % de diferencia de "nuestro precio" contra el promedio de la competencia
 * (positivo = más caro que la competencia). `null` si no hay datos
 * suficientes (falta el propio o ningún precio de competencia) — nunca se
 * muestra una comparación sin base real.
 */
export function competitorPriceDelta(ourPrice: number | null, competitorPrices: number[]): number | null {
  if (ourPrice == null || competitorPrices.length === 0) return null;
  const avg = competitorPrices.reduce((a, b) => a + b, 0) / competitorPrices.length;
  if (avg === 0) return null;
  return ((ourPrice - avg) / avg) * 100;
}
