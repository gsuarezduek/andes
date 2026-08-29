import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { parseApiResponse } from "../rentauto";
import { resolveGroundedPrice } from "../../grounding";
import { formatArs } from "@/lib/contract";

const FIXTURE_PATH = path.join(__dirname, "fixtures/rentauto-availability.json");
const SOURCE_URL = "https://www.rentautoargentina.com.ar/common/functionality/companyManager.php";

function loadFixture(): string {
  return readFileSync(FIXTURE_PATH, "utf-8");
}

describe("parseApiResponse", () => {
  it("extrae los 5 autos del fixture real (respuesta doblemente JSON-encodeada)", () => {
    const items = parseApiResponse(loadFixture(), SOURCE_URL);
    expect(items).toHaveLength(5);
  });

  it("cada ítem trae rawLabel, priceCandidate en ARS y sourceUrl", () => {
    const items = parseApiResponse(loadFixture(), SOURCE_URL);
    const compacto = items.find((i) => i.rawLabel === "Compacto");
    expect(compacto).toBeDefined();
    expect(compacto?.sourceUrl).toBe(SOURCE_URL);
    expect(compacto?.priceCandidate).toEqual({ priceText: formatArs(54999.9934), currency: "ars" });
  });

  it("el precio citado pasa el chequeo de grounding y parsea al valor correcto", () => {
    const items = parseApiResponse(loadFixture(), SOURCE_URL);
    const compacto = items.find((i) => i.rawLabel === "Compacto")!;
    const grounded = resolveGroundedPrice(
      { priceText: compacto.priceCandidate!.priceText, currency: compacto.priceCandidate!.currency, vehicleLabel: compacto.rawLabel },
      compacto.rawText,
    );
    expect(grounded).toEqual({ price: 54999.99, currency: "ars" });
  });

  it("un precio redondo (sin centavos) también groundea bien (formatArs no imprime coma cuando no hace falta)", () => {
    const items = parseApiResponse(loadFixture(), SOURCE_URL);
    const economico = items.find((i) => i.rawLabel === "Económico 5 P")!;
    expect(economico.priceCandidate).toEqual({ priceText: formatArs(45000), currency: "ars" });
    expect(economico.priceCandidate?.priceText).not.toContain(",");
    const grounded = resolveGroundedPrice(
      { priceText: economico.priceCandidate!.priceText, currency: economico.priceCandidate!.currency, vehicleLabel: economico.rawLabel },
      economico.rawText,
    );
    expect(grounded).toEqual({ price: 45000, currency: "ars" });
  });

  it("respuesta simple (un solo nivel de JSON, no doble) también se parsea — tolera que el server lo arregle algún día", () => {
    const items = parseApiResponse(JSON.stringify([{ vehiculo_categoria: "SUV", vehiculo_modelo: "Tracker", monedaId: 1, costosFinales: { costoPorDia: 80000 } }]), SOURCE_URL);
    expect(items).toHaveLength(1);
    expect(items[0].rawLabel).toBe("SUV");
  });

  it("array vacío (sin disponibilidad) → sin ítems, no explota", () => {
    expect(parseApiResponse(JSON.stringify("[]"), SOURCE_URL)).toEqual([]);
  });

  it("moneda desconocida se descarta (nunca se inventa el signo)", () => {
    const items = parseApiResponse(
      JSON.stringify(JSON.stringify([{ vehiculo_categoria: "SUV", monedaId: 99, costosFinales: { costoPorDia: 1000 } }])),
      SOURCE_URL,
    );
    expect(items).toEqual([]);
  });

  it("JSON inválido → lista vacía, no explota", () => {
    expect(parseApiResponse("esto no es json", SOURCE_URL)).toEqual([]);
  });
});
