import { describe, expect, it } from "vitest";
import { buildConditionLines } from "@/lib/condition-lines";

describe("buildConditionLines", () => {
  it("devuelve [] sin condiciones", () => {
    expect(buildConditionLines(null)).toEqual([]);
  });

  it("devuelve [] si todos los campos son null", () => {
    expect(buildConditionLines({ kmPerDay: null, extraKmRate: null, deductible: null, deductibleReduced: null })).toEqual([]);
  });

  it("arma una línea por campo cargado", () => {
    const lines = buildConditionLines({ kmPerDay: 200, extraKmRate: 150, deductible: 500000, deductibleReduced: 200000 });
    expect(lines).toEqual([
      "Km incluidos por día: 200 km.",
      "Km extra: $150 por km.",
      "Franquicia del seguro: $500000.",
      'Franquicia reducida con "mejora de seguro": $200000.',
    ]);
  });

  it("omite los campos sin cargar", () => {
    expect(buildConditionLines({ kmPerDay: 200, extraKmRate: null, deductible: null, deductibleReduced: null })).toEqual([
      "Km incluidos por día: 200 km.",
    ]);
  });

  it("con franquicia de camionetas distinta, da los dos valores y nombra los modelos", () => {
    const lines = buildConditionLines({
      kmPerDay: null,
      extraKmRate: null,
      deductible: 600000,
      deductibleReduced: 400000,
      truck: { deductible: 900000, deductibleReduced: 600000, models: ["Chevrolet Spin", "Volkswagen Amarok"] },
    });
    expect(lines).toEqual([
      "Franquicia del seguro: $600000 en autos; $900000 en camionetas (Chevrolet Spin, Volkswagen Amarok).",
      'Franquicia reducida con "mejora de seguro": $400000 en autos; $600000 en camionetas.',
    ]);
  });

  it("si la de camionetas es igual, una sola cifra", () => {
    const lines = buildConditionLines({
      kmPerDay: null,
      extraKmRate: null,
      deductible: 600000,
      deductibleReduced: null,
      truck: { deductible: 600000, deductibleReduced: null, models: ["Chevrolet Spin"] },
    });
    expect(lines).toEqual(["Franquicia del seguro: $600000."]);
  });
});
