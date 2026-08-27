/**
 * Tipos compartidos del pipeline de precios de la competencia.
 *
 * El motor es agnóstico del transporte: consume un `CompetitorPriceAdapter`
 * por competidor (mirror de `BookingSource` en src/lib/sync/types.ts). Cada
 * sitio tiene su propio flujo/selectores — no es un motor genérico por
 * config, cada adaptador es un módulo chico dedicado (ver adapters/).
 *
 * Un adaptador busca UNA vez por (competidor, ventana de fechas) — igual que
 * un sitio real: se cotiza por fecha y devuelve TODOS los autos disponibles
 * con precio, no "dame solo los económicos". La categorización de cada auto
 * devuelto es responsabilidad del motor (normalización, ver grounding.ts +
 * CompetitorCategoryMapping), no del adaptador.
 */

import type { Competitor } from "@prisma/client";

/** Ventana de fechas a cotizar (ya resueltas desde CompetitorPriceSettings). */
export type PriceCheckWindow = {
  pickupDate: Date;
  returnDate: Date;
  days: number;
  /** Offset en días desde "hoy" (0/30/60/...) — identifica la celda de CompetitorCurrentPrice. */
  offsetDays: number;
};

/** Un vehículo/precio crudo devuelto por el adaptador, sin categorizar todavía. */
export type RawPriceItem = {
  rawLabel: string;
  /** Contenido de texto del contenedor de resultados de ESTE ítem — para el
   *  fallback de extracción del LLM y su chequeo de grounding. Nunca se
   *  descarta antes de intentar extraer algo. */
  rawText: string;
  sourceUrl: string;
  /** Candidato de precio ya identificado por selectores, si el adaptador pudo. */
  priceCandidate?: { priceText: string; currency: "ars" | "usd" };
};

/** Resultado crudo de un adaptador para una combinación competidor × ventana de fechas. */
export type RawPriceResult = { status: "found"; items: RawPriceItem[] } | { status: "unavailable"; reason: string };

export interface CompetitorPriceAdapter {
  /** Matchea Competitor.adapterKey. */
  readonly key: string;
  fetchPrices(params: { competitor: Competitor; window: PriceCheckWindow }): Promise<RawPriceResult>;
}
