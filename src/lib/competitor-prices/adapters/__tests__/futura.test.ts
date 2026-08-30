import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { parseApiResponse } from "../futura";
import { resolveGroundedPrice } from "../../grounding";
import { formatArs } from "@/lib/contract";

const FIXTURE_PATH = path.join(__dirname, "fixtures/futura-availability.json");
const SOURCE_URL = "https://www.futurarentacar.com.ar:8443/futura/ws/futura/obtenerDisponibilidadReservaData";

function loadFixture(): string {
  return readFileSync(FIXTURE_PATH, "utf-8");
}

describe("parseApiResponse (Futura)", () => {
  it("extrae los 8 autos del fixture real (ventana de 3 días)", () => {
    const items = parseApiResponse(loadFixture(), 3, SOURCE_URL);
    expect(items).toHaveLength(8);
  });

  it("divide el precio TOTAL del período por los días de la ventana (precio por día, no el total)", () => {
    const items = parseApiResponse(loadFixture(), 3, SOURCE_URL);
    const gol = items.find((i) => i.rawText.includes("VOLKSWAGEN GOL"))!;
    expect(gol.rawLabel).toBe("Compacto Manual");
    expect(gol.priceCandidate).toEqual({ priceText: formatArs(58000), currency: "ars" });
    expect(gol.sourceUrl).toBe(SOURCE_URL);
  });

  it("el precio citado pasa el chequeo de grounding y parsea al valor correcto", () => {
    const items = parseApiResponse(loadFixture(), 3, SOURCE_URL);
    const gol = items.find((i) => i.rawText.includes("VOLKSWAGEN GOL"))!;
    const grounded = resolveGroundedPrice(
      { priceText: gol.priceCandidate!.priceText, currency: gol.priceCandidate!.currency, vehicleLabel: gol.rawLabel },
      gol.rawText,
    );
    expect(grounded).toEqual({ price: 58000, currency: "ars" });
  });

  it("distintos días con la misma clase (Sedan Manual) quedan como ítems separados, cada uno con su propio rawText", () => {
    const items = parseApiResponse(loadFixture(), 3, SOURCE_URL);
    const sedanes = items.filter((i) => i.rawLabel === "Sedan Manual");
    expect(sedanes).toHaveLength(3);
    expect(new Set(sedanes.map((i) => i.rawText)).size).toBe(3);
  });

  it("con 0 días no divide por cero — devuelve lista vacía", () => {
    expect(parseApiResponse(loadFixture(), 0, SOURCE_URL)).toEqual([]);
  });

  it("lista vacía (sin disponibilidad) → sin ítems, no explota", () => {
    expect(parseApiResponse(JSON.stringify({ disponibilidadReservaExactaDataList: [] }), 3, SOURCE_URL)).toEqual([]);
  });

  it("JSON inválido → lista vacía, no explota", () => {
    expect(parseApiResponse("esto no es json", 3, SOURCE_URL)).toEqual([]);
  });

  it("ítem sin precio o sin clase se descarta sin romper el resto", () => {
    const body = JSON.stringify({
      disponibilidadReservaExactaDataList: [
        { modeloVehiculo: { nombre: "SIN PRECIO", claseVehiculo: { nombre: "Compacto" } }, precio: null },
        { modeloVehiculo: { nombre: "SIN CLASE" }, precio: 90000 },
        { modeloVehiculo: { nombre: "OK", claseVehiculo: { nombre: "SUV" } }, precio: 90000 },
      ],
    });
    const items = parseApiResponse(body, 3, SOURCE_URL);
    expect(items).toHaveLength(1);
    expect(items[0].rawLabel).toBe("SUV");
  });
});
