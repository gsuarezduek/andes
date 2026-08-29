import "server-only";
import type { Competitor } from "@prisma/client";
import { formatDateInput } from "@/lib/datetime";
import { formatArs } from "@/lib/contract";
import type { CompetitorPriceAdapter, PriceCheckWindow, RawPriceItem, RawPriceResult } from "../types";

const API_URL = "https://www.rentautoargentina.com.ar/common/functionality/companyManager.php";
/** "Aeropuerto de Mendoza" en el buscador — overrideable vía `Competitor.config.locationCode`. */
const DEFAULT_LOCATION_CODE = "A19";
/** `monedaId` de la API → nuestro enum. Solo ARS visto en la práctica; otro código se descarta (no se inventa). */
const CURRENCY_BY_MONEDA_ID: Record<number, "ars" | "usd"> = { 1: "ars" };

type RentautoConfig = { locationCode?: string };

type AvailabilityItem = {
  vehiculo_categoria?: string;
  vehiculo_modelo?: string;
  monedaId?: number;
  costosFinales?: { costoPorDia?: number };
};

/**
 * Adaptador real de Rentauto Argentina — sin Playwright. El buscador del
 * sitio pega a un endpoint JSON sin ninguna protección (probado a mano: ni
 * CSRF token, ni sesión, ni rate limit visible) que devuelve precio por día
 * ya calculado — no hace falta parsear HTML ni levantar un browser. La
 * respuesta viene con un nivel extra de `JSON.stringify` (server-side
 * quirk, verificado contra el sitio real) — `parseApiResponse` lo maneja.
 */
export const rentautoAdapter: CompetitorPriceAdapter = {
  key: "rentauto",

  async fetchPrices(params: { competitor: Competitor; window: PriceCheckWindow }): Promise<RawPriceResult> {
    const { competitor, window } = params;
    const config = (competitor.config ?? {}) as RentautoConfig;
    const locationCode = config.locationCode ?? DEFAULT_LOCATION_CODE;
    const fechaDesde = formatDateInput(window.pickupDate);
    const fechaHasta = formatDateInput(window.returnDate);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "availability",
          company: "rentauto",
          values: {
            codigo_ciudad_desde: locationCode,
            fecha_desde: fechaDesde,
            hora_desde: "10:00",
            codigo_ciudad_hasta: locationCode,
            fecha_hasta: fechaHasta,
            hora_hasta: "10:00",
            codigo_tarifa: "",
            tipoBusqueda: true,
          },
        }),
      });
      if (!res.ok) {
        return { status: "unavailable", reason: `API respondió ${res.status}` };
      }

      const items = parseApiResponse(await res.text(), API_URL);
      if (items.length === 0) {
        return { status: "unavailable", reason: "sin autos disponibles para esas fechas" };
      }
      return { status: "found", items };
    } catch (e) {
      return { status: "unavailable", reason: e instanceof Error ? e.message : String(e) };
    }
  },
};

/**
 * Extracción pura (sin red) de la respuesta del endpoint — testeada con una
 * respuesta real capturada a mano. El body viene JSON-encodeado dos veces
 * (quirk del server); si algún día lo corrigen, un solo parse ya deja un
 * array y el segundo intento es un no-op seguro.
 */
export function parseApiResponse(rawBody: string, sourceUrl: string): RawPriceItem[] {
  let data: unknown;
  try {
    data = JSON.parse(rawBody);
  } catch {
    return [];
  }
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(data)) return [];

  const items: RawPriceItem[] = [];
  for (const raw of data as AvailabilityItem[]) {
    const rawLabel = raw.vehiculo_categoria?.trim();
    const priceValue = raw.costosFinales?.costoPorDia;
    const currency = raw.monedaId != null ? CURRENCY_BY_MONEDA_ID[raw.monedaId] : undefined;
    if (!rawLabel || priceValue == null || !currency) continue;

    const priceText = formatArs(priceValue);
    items.push({
      rawLabel,
      rawText: `${rawLabel} — ${raw.vehiculo_modelo ?? ""} — ${priceText} por día (con impuestos)`,
      sourceUrl,
      priceCandidate: { priceText, currency },
    });
  }
  return items;
}
