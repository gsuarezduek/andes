import "server-only";
import { parse } from "node-html-parser";
import type { Competitor } from "@prisma/client";
import { formatDateInput } from "@/lib/datetime";
import { withBrowserPage } from "./browser";
import type { CompetitorPriceAdapter, PriceCheckWindow, RawPriceItem, RawPriceResult } from "../types";

const BASE_URL = "https://invernaliarentacar.com/";
/** "AEROPUERTO MENDOZA (MDZ)" en el `<select>` de sucursal — overrideable vía `Competitor.config.locationId`. */
const DEFAULT_LOCATION_ID = "8";

type InvernaliaConfig = { locationId?: string };

/** "2026-08-27" (formatDateInput) → "27/08/2026", el formato que espera el input del datepicker. */
function toDDMMYYYY(date: Date): string {
  const [y, m, d] = formatDateInput(date).split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Adaptador real de Invernalia Rent a Car (Playwright). El formulario usa un
 * datepicker jQuery UI de solo-lectura, pero el input de texto subyacente
 * (`name=pickup_date`/`return_date`) es lo único que el buscador realmente
 * lee al enviar — setear su `.value` por JS y disparar `input`/`change`
 * evita tener que navegar la UI del calendario mes a mes (mucho más frágil:
 * el calendario de "devolución" a veces se abre mostrando el mes siguiente
 * al de retiro, no el mismo, según se descubrió probando a mano).
 */
export const invernaliaAdapter: CompetitorPriceAdapter = {
  key: "invernalia",

  async fetchPrices(params: { competitor: Competitor; window: PriceCheckWindow }): Promise<RawPriceResult> {
    const { competitor, window } = params;
    const config = (competitor.config ?? {}) as InvernaliaConfig;
    const locationId = config.locationId ?? DEFAULT_LOCATION_ID;
    const pickupStr = toDDMMYYYY(window.pickupDate);
    const returnStr = toDDMMYYYY(window.returnDate);

    try {
      return await withBrowserPage(async (page) => {
        await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
        await page.waitForTimeout(2_000);

        const closeCookieModal = page.locator("#cliModalClose");
        if ((await closeCookieModal.count()) > 0) {
          await closeCookieModal.click().catch(() => {});
          await page.waitForTimeout(300);
        }

        await page.selectOption("#pickup_location_id", locationId, { force: true });
        await page.selectOption("#return_location_id", locationId, { force: true });

        await page.evaluate(
          ({ pickupStr, returnStr }) => {
            for (const [name, value] of [
              ["pickup_date", pickupStr],
              ["return_date", returnStr],
            ] as const) {
              const el = document.querySelector<HTMLInputElement>(`input[name="${name}"]`);
              if (!el) continue;
              el.value = value;
              el.dispatchEvent(new Event("input", { bubbles: true }));
              el.dispatchEvent(new Event("change", { bubbles: true }));
            }
          },
          { pickupStr, returnStr },
        );

        const searchButton = page.locator("button[name=car_rental_do_search]");
        await Promise.all([
          page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20_000 }).catch(() => {}),
          searchButton.click(),
        ]);
        await page.waitForTimeout(3_000);

        const html = await page.content();
        const items = parseInvernaliaResults(html, page.url());
        if (items.length === 0) {
          return { status: "unavailable", reason: "no se encontraron autos en la búsqueda" };
        }
        return { status: "found", items };
      });
    } catch (e) {
      return { status: "unavailable", reason: e instanceof Error ? e.message : String(e) };
    }
  },
};

const CURRENCY_MAP: Record<string, "ars" | "usd"> = { ARS: "ars", USD: "usd" };

/**
 * Extracción pura (sin browser) de la página de resultados —
 * `/proceso-de-reserva/` — testeada con un fixture de HTML real. Cada
 * tarjeta `.single-car-list` trae categoría, moneda y precio "Por día" en
 * selectores estables; no hace falta el fallback del LLM para este sitio.
 */
export function parseInvernaliaResults(html: string, sourceUrl: string): RawPriceItem[] {
  const root = parse(html);
  const items: RawPriceItem[] = [];

  for (const card of root.querySelectorAll(".single-car-list")) {
    const rawLabel = card.querySelector("h4")?.text.trim();
    const currencyText = card.querySelector(".single-item-curr")?.text.trim().toUpperCase();
    const currency = currencyText ? CURRENCY_MAP[currencyText] : undefined;
    if (!rawLabel || !currency) continue;

    let priceText: string | undefined;
    for (const block of card.querySelectorAll(".bottom-fixed .block_full")) {
      const title = block.querySelector(".item_list_mileage_title")?.text.trim();
      if (title === "Por día") {
        priceText = block.querySelector(".item_list_mileage")?.text.trim();
        break;
      }
    }
    if (!priceText) continue;

    items.push({
      rawLabel,
      rawText: card.text,
      sourceUrl,
      priceCandidate: { priceText, currency },
    });
  }

  return items;
}
