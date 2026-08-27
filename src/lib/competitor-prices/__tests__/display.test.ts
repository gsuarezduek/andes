import { describe, it, expect } from "vitest";
import { priceCheckStatusDisplay, competitorPriceDelta } from "../display";

describe("priceCheckStatusDisplay", () => {
  it("mapea cada estado a su label/tono", () => {
    expect(priceCheckStatusDisplay("verified")).toEqual({ label: "Verificado", tone: "emerald" });
    expect(priceCheckStatusDisplay("auto_found")).toEqual({ label: "Encontrado automático", tone: "blue" });
    expect(priceCheckStatusDisplay("needs_review")).toEqual({ label: "Requiere revisión", tone: "amber" });
    expect(priceCheckStatusDisplay("unavailable")).toEqual({ label: "No disponible", tone: "neutral" });
  });
});

describe("competitorPriceDelta", () => {
  it("más caro que el promedio → % positivo", () => {
    expect(competitorPriceDelta(112, [100, 100])).toBeCloseTo(12);
  });

  it("más barato que el promedio → % negativo", () => {
    expect(competitorPriceDelta(92, [100, 100])).toBeCloseTo(-8);
  });

  it("sin nuestro precio → null", () => {
    expect(competitorPriceDelta(null, [100])).toBeNull();
  });

  it("sin precios de competencia → null", () => {
    expect(competitorPriceDelta(100, [])).toBeNull();
  });

  it("promedia varios competidores", () => {
    expect(competitorPriceDelta(100, [80, 100, 120])).toBeCloseTo(0);
  });
});
