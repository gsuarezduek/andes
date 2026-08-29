import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { parseInvernaliaResults } from "../invernalia";
import { resolveGroundedPrice } from "../../grounding";

const FIXTURE_PATH = path.join(__dirname, "fixtures/invernalia-results.html");
const SOURCE_URL = "https://invernaliarentacar.com/proceso-de-reserva/";

function loadFixture(): string {
  return readFileSync(FIXTURE_PATH, "utf-8");
}

describe("parseInvernaliaResults", () => {
  it("extrae las 12 categorías del fixture real", () => {
    const items = parseInvernaliaResults(loadFixture(), SOURCE_URL);
    expect(items).toHaveLength(12);
  });

  it("cada ítem trae rawLabel, priceCandidate y sourceUrl", () => {
    const items = parseInvernaliaResults(loadFixture(), SOURCE_URL);
    const economicos = items.find((i) => i.rawLabel === "Economicos");
    expect(economicos).toBeDefined();
    expect(economicos?.sourceUrl).toBe(SOURCE_URL);
    expect(economicos?.priceCandidate).toEqual({ priceText: "ARS$ 80.444,07", currency: "ars" });
  });

  it("el precio citado pasa el chequeo de grounding y parsea al valor correcto (precio POR DÍA, no el total del período)", () => {
    const items = parseInvernaliaResults(loadFixture(), SOURCE_URL);
    const economicos = items.find((i) => i.rawLabel === "Economicos")!;
    const grounded = resolveGroundedPrice(
      { priceText: economicos.priceCandidate!.priceText, currency: economicos.priceCandidate!.currency, vehicleLabel: economicos.rawLabel },
      economicos.rawText,
    );
    expect(grounded).toEqual({ price: 80444.07, currency: "ars" });
  });

  it("incluye VIP Cars con su propio precio", () => {
    const items = parseInvernaliaResults(loadFixture(), SOURCE_URL);
    const vip = items.find((i) => i.rawLabel === "VIP Cars");
    expect(vip?.priceCandidate).toEqual({ priceText: "ARS$ 459.680,41", currency: "ars" });
  });

  it("rawText de cada ítem alcanza para groundear tanto el precio como la categoría de todos los ítems (sin falsos negativos cruzados)", () => {
    const items = parseInvernaliaResults(loadFixture(), SOURCE_URL);
    for (const item of items) {
      const grounded = resolveGroundedPrice(
        { priceText: item.priceCandidate!.priceText, currency: item.priceCandidate!.currency, vehicleLabel: item.rawLabel },
        item.rawText,
      );
      expect(grounded).not.toBeNull();
    }
  });

  it("HTML sin tarjetas de resultado → lista vacía, no explota", () => {
    const items = parseInvernaliaResults("<html><body><p>Sin resultados</p></body></html>", SOURCE_URL);
    expect(items).toEqual([]);
  });
});
