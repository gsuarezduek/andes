import type { Competitor } from "@prisma/client";
import type { CompetitorPriceAdapter, PriceCheckWindow, RawPriceResult } from "../types";

/**
 * Adaptador de prueba con datos enlatados — sin Playwright ni red. Permite
 * validar el pipeline completo (motor, normalización, grounding, UI) sin
 * depender de que ningún sitio real sea scrapeable todavía (ver el orden de
 * implementación del plan: primero el pipeline contra este mock, después
 * los adaptadores reales).
 */
export const mockAdapter: CompetitorPriceAdapter = {
  key: "mock",

  async fetchPrices(params: { competitor: Competitor; window: PriceCheckWindow }): Promise<RawPriceResult> {
    void params; // datos enlatados, no depende de competitor/window todavía
    return {
      status: "found",
      items: [
        {
          rawLabel: "Chevrolet Onix o similar",
          rawText: "Chevrolet Onix o similar — $75.000 por 3 días. Incluye seguro básico.",
          sourceUrl: "https://example-competitor.test/resultados?mock=1",
          priceCandidate: { priceText: "$75.000", currency: "ars" },
        },
        {
          rawLabel: "Jeep Renegade o similar",
          rawText: "Jeep Renegade o similar — $150.000 por 3 días. Incluye seguro básico.",
          sourceUrl: "https://example-competitor.test/resultados?mock=2",
          priceCandidate: { priceText: "$150.000", currency: "ars" },
        },
      ],
    };
  },
};
