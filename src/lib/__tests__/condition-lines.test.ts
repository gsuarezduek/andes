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
});
