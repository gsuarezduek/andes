import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { parseApiResponse } from "../builderduck";
import { resolveGroundedPrice } from "../../grounding";
import { formatArs } from "@/lib/contract";

const FIXTURE_PATH = path.join(__dirname, "fixtures/builderduck-taraborelli.json");
const SOURCE_URL = "https://api.builderduck.com/api/booking/search?bookingBrandId=1";

function loadFixture(): string {
  return readFileSync(FIXTURE_PATH, "utf-8");
}

describe("parseApiResponse (BuilderDuck)", () => {
  it("extrae los 8 autos del fixture real (Taraborelli, ARS)", () => {
    const items = parseApiResponse(loadFixture(), SOURCE_URL);
    expect(items).toHaveLength(8);
  });

  it("usa averageDayPrice directo (ya viene por día, no hay que dividir por los días del período)", () => {
    const items = parseApiResponse(loadFixture(), SOURCE_URL);
    const sedan = items.find((i) => i.rawLabel === "Sedan Económico MT")!;
    expect(sedan.priceCandidate).toEqual({ priceText: formatArs(65567.73), currency: "ars" });
    expect(sedan.sourceUrl).toBe(SOURCE_URL);
  });

  it("el precio citado pasa el chequeo de grounding y parsea al valor correcto", () => {
    const items = parseApiResponse(loadFixture(), SOURCE_URL);
    const sedan = items.find((i) => i.rawLabel === "Sedan Económico MT")!;
    const grounded = resolveGroundedPrice(
      { priceText: sedan.priceCandidate!.priceText, currency: sedan.priceCandidate!.currency, vehicleLabel: sedan.rawLabel },
      sedan.rawText,
    );
    expect(grounded).toEqual({ price: 65567.73, currency: "ars" });
  });

  it("respuesta en USD (ej. Street Rent a Car) también groundea bien", () => {
    const body = JSON.stringify([
      { category: { name: "Medium" }, car: { model: { description: "Corolla" } }, averageDayPrice: 24.4, currency: "USD" },
    ]);
    const items = parseApiResponse(body, SOURCE_URL);
    expect(items).toHaveLength(1);
    expect(items[0].priceCandidate).toEqual({ priceText: "US$24.40", currency: "usd" });
    const grounded = resolveGroundedPrice(
      { priceText: items[0].priceCandidate!.priceText, currency: "usd", vehicleLabel: "Medium" },
      items[0].rawText,
    );
    expect(grounded).toEqual({ price: 24.4, currency: "usd" });
  });

  it("moneda desconocida se descarta (nunca se inventa el signo)", () => {
    const body = JSON.stringify([
      { category: { name: "SUV" }, car: { model: { description: "X" } }, averageDayPrice: 1000, currency: "EUR" },
    ]);
    expect(parseApiResponse(body, SOURCE_URL)).toEqual([]);
  });

  it("ítem sin categoría, sin modelo o sin precio se descarta sin romper el resto", () => {
    const body = JSON.stringify([
      { category: { name: "Sin modelo" }, car: {}, averageDayPrice: 1000, currency: "ARS" },
      { category: {}, car: { model: { description: "Sin categoría" } }, averageDayPrice: 1000, currency: "ARS" },
      { category: { name: "OK" }, car: { model: { description: "Modelo OK" } }, averageDayPrice: null, currency: "ARS" },
      { category: { name: "Bien" }, car: { model: { description: "Todo bien" } }, averageDayPrice: 1000, currency: "ARS" },
    ]);
    const items = parseApiResponse(body, SOURCE_URL);
    expect(items).toHaveLength(1);
    expect(items[0].rawLabel).toBe("Bien");
  });

  it("no es un array (ej. respuesta de error) → lista vacía, no explota", () => {
    expect(parseApiResponse(JSON.stringify({ error: "algo salió mal" }), SOURCE_URL)).toEqual([]);
  });

  it("JSON inválido → lista vacía, no explota", () => {
    expect(parseApiResponse("esto no es json", SOURCE_URL)).toEqual([]);
  });
});
