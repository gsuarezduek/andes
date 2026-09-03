import "server-only";
import type { Competitor } from "@prisma/client";
import { formatDateInput } from "@/lib/datetime";
import { formatArs } from "@/lib/contract";
import type { CompetitorPriceAdapter, PriceCheckWindow, RawPriceItem, RawPriceResult } from "../types";

const API_URL = "https://api.builderduck.com/api/booking/search";
/** Hora fija de retiro/devolución dentro del horario de atención habitual — probado a mano: fuera de
 *  horario (ej. 00:00) la API devuelve 0 ítems aunque haya autos reales disponibles ese día. */
const SAFE_HOUR = "10:00";
const DEFAULT_BOOKING_BRAND_ID = "1";
const DEFAULT_LANGUAGE = "es-AR";

type BuilderDuckConfig = {
  /** Origen del sitio de la marca (ej. "https://www.taraborellirentacar.com") — la API lo exige vía Origin/Referer. */
  originUrl: string;
  /** `branchOfficeId` de retiro/devolución (mismo para ambos — sin devolución en otra sucursal por ahora). */
  placeId: string;
  bookingBrandId?: string;
  language?: string;
};

type SearchResultItem = {
  category?: { name?: string };
  car?: { model?: { description?: string } };
  averageDayPrice?: number | null;
  currency?: string | null;
};

const CURRENCY_MAP: Record<string, "ars" | "usd"> = { ARS: "ars", USD: "usd" };

/** "2026-09-10" (formatDateInput) → "2026/09/10", el formato que espera la API. */
function toSlashDate(date: Date): string {
  return formatDateInput(date).replaceAll("-", "/");
}

/**
 * Adaptador genérico para sitios sobre la plataforma "BuilderDuck"
 * (api.builderduck.com) — sin Playwright. A diferencia de los demás
 * adaptadores (un módulo por sitio), este es compartido a propósito: se
 * descubrió que Taraborelli Rent a Car y Street Rent a Car corren sobre el
 * mismo backend con el mismo contrato de API, difiriendo solo en
 * `Competitor.config` (dominio de origen, sucursal, marca) — duplicar el
 * fetch/parse en dos archivos idénticos sería puro copy-paste, no una
 * variante real de sitio como sí lo son los otros adaptadores.
 */
export const builderduckAdapter: CompetitorPriceAdapter = {
  key: "builderduck",

  async fetchPrices(params: { competitor: Competitor; window: PriceCheckWindow }): Promise<RawPriceResult> {
    const { competitor, window } = params;
    const config = competitor.config as BuilderDuckConfig | null;
    if (!config?.originUrl || !config?.placeId) {
      return { status: "unavailable", reason: "falta config.originUrl/placeId para este competidor" };
    }

    const search = new URLSearchParams({
      from: `${toSlashDate(window.pickupDate)} ${SAFE_HOUR}`,
      to: `${toSlashDate(window.returnDate)} ${SAFE_HOUR}`,
      fromPlace: config.placeId,
      toPlace: config.placeId,
      ilimitedKm: "false",
      showFinalPrice: "true",
      onlyFullAvailability: "false",
      bookingBrandId: config.bookingBrandId ?? DEFAULT_BOOKING_BRAND_ID,
      language: config.language ?? DEFAULT_LANGUAGE,
    });
    const sourceUrl = `${API_URL}?${search}`;

    try {
      const res = await fetch(sourceUrl, {
        headers: { Origin: config.originUrl, Referer: `${config.originUrl}/` },
      });
      if (!res.ok) {
        return { status: "unavailable", reason: `API respondió ${res.status}` };
      }

      const items = parseApiResponse(await res.text(), sourceUrl);
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
export function parseApiResponse(rawBody: string, sourceUrl: string): RawPriceItem[] {
  let data: unknown;
  try {
    data = JSON.parse(rawBody);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];

  const items: RawPriceItem[] = [];
  for (const raw of data as SearchResultItem[]) {
    const rawLabel = raw.category?.name?.trim();
    const modelo = raw.car?.model?.description?.trim();
    const priceValue = raw.averageDayPrice;
    const currency = raw.currency ? CURRENCY_MAP[raw.currency] : undefined;
    if (!rawLabel || !modelo || priceValue == null || !currency) continue;

    // El precio en ARS lo formatea formatArs (convención argentina, punto de
    // miles/coma decimal); en USD no hay un formateador propio en el
    // proyecto — se arma a mano en la misma convención "us" que ya entiende
    // parsePriceText (coma de miles, punto decimal).
    const priceText = currency === "ars" ? formatArs(priceValue) : `US$${priceValue.toFixed(2)}`;
    items.push({
      rawLabel,
      rawText: `${modelo} (${rawLabel}) — ${priceText} por día`,
      sourceUrl,
      priceCandidate: { priceText, currency },
    });
  }
  return items;
}
