import "server-only";
import type { Competitor } from "@prisma/client";
import { formatArs } from "@/lib/contract";
import type { CompetitorPriceAdapter, PriceCheckWindow, RawPriceItem, RawPriceResult } from "../types";

const API_URL = "https://www.futurarentacar.com.ar:8443/futura/ws/futura/obtenerDisponibilidadReservaData";
/** Sucursal "Mendoza" en el buscador — overrideable vía `Competitor.config.locationId`. */
const DEFAULT_LOCATION_ID = "1";

type FuturaConfig = { locationId?: string };

type DisponibilidadItem = {
  modeloVehiculo?: {
    nombre?: string;
    claseVehiculo?: { nombre?: string };
  };
  precio?: number | null;
};

/**
 * Adaptador real de Futura Rent a Car — sin Playwright. El buscador pega a
 * un endpoint JSON propio (obtenerDisponibilidadReservaData) sin ninguna
 * protección, verificado a mano: la hora exacta del ISO timestamp no
 * importa, solo la fecha calendario (probado con tres horarios distintos,
 * mismo resultado) — un simple `Date.toISOString()` de nuestras fechas ya
 * resueltas alcanza. `precio` es el TOTAL del período con el 20% de
 * descuento por pago online (no el de "pagar en destino", que el sitio
 * calcula recién en el cliente) — se divide por los días de la ventana para
 * el precio por día que espera el resto del pipeline.
 */
export const futuraAdapter: CompetitorPriceAdapter = {
  key: "futura",

  async fetchPrices(params: { competitor: Competitor; window: PriceCheckWindow }): Promise<RawPriceResult> {
    const { competitor, window } = params;
    const config = (competitor.config ?? {}) as FuturaConfig;
    const locationId = config.locationId ?? DEFAULT_LOCATION_ID;

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fechaInicio: window.pickupDate.toISOString(),
          fechaFin: window.returnDate.toISOString(),
          sucursal: { id: locationId },
          sucursalDevolucion: { id: locationId },
        }),
      });
      if (!res.ok) {
        return { status: "unavailable", reason: `API respondió ${res.status}` };
      }

      const items = parseApiResponse(await res.text(), window.days, API_URL);
      if (items.length === 0) {
        return { status: "unavailable", reason: "sin autos disponibles para esas fechas" };
      }
      return { status: "found", items };
    } catch (e) {
      return { status: "unavailable", reason: e instanceof Error ? e.message : String(e) };
    }
  },
};

/** Extracción pura (sin red) de la respuesta del endpoint — testeada con una respuesta real capturada a mano. */
export function parseApiResponse(rawBody: string, days: number, sourceUrl: string): RawPriceItem[] {
  let data: unknown;
  try {
    data = JSON.parse(rawBody);
  } catch {
    return [];
  }
  const list = (data as { disponibilidadReservaExactaDataList?: unknown }).disponibilidadReservaExactaDataList;
  if (!Array.isArray(list) || days <= 0) return [];

  const items: RawPriceItem[] = [];
  for (const raw of list as DisponibilidadItem[]) {
    const rawLabel = raw.modeloVehiculo?.claseVehiculo?.nombre?.trim();
    const modelo = raw.modeloVehiculo?.nombre?.trim();
    const total = raw.precio;
    if (!rawLabel || !modelo || total == null) continue;

    const priceText = formatArs(total / days);
    items.push({
      rawLabel,
      rawText: `${modelo} (${rawLabel}) — ${priceText} por día, pago online`,
      sourceUrl,
      priceCandidate: { priceText, currency: "ars" },
    });
  }
  return items;
}
