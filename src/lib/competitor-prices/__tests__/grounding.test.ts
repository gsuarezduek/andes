import { describe, it, expect } from "vitest";
import { isGrounded, parsePriceText, resolveGroundedPrice, type LlmCitation } from "../grounding";

describe("parsePriceText", () => {
  it("formato argentino: punto de miles", () => {
    expect(parsePriceText("$150.000", "ars")).toBe(150000);
    expect(parsePriceText("150.000", "ars")).toBe(150000);
  });

  it("formato argentino: coma decimal", () => {
    expect(parsePriceText("$1.500,50", "ars")).toBe(1500.5);
  });

  it("formato US: coma de miles, punto decimal", () => {
    expect(parsePriceText("US$1,500.50", "usd")).toBe(1500.5);
    expect(parsePriceText("$200", "usd")).toBe(200);
  });

  it("sin dígitos → null", () => {
    expect(parsePriceText("Consultar", "ars")).toBeNull();
    expect(parsePriceText("Gratis", "ars")).toBeNull();
  });

  it("cero o negativo → null (no es un precio válido)", () => {
    expect(parsePriceText("$0", "ars")).toBeNull();
  });
});

describe("isGrounded", () => {
  const rawText = 'Chevrolet Onix o similar — $150.000 por 3 días. Incluye seguro básico.';

  it("precio y vehículo presentes → true", () => {
    const citation: LlmCitation = {
      priceText: "$150.000",
      currency: "ars",
      vehicleLabel: "Chevrolet Onix o similar",
    };
    expect(isGrounded(citation, rawText)).toBe(true);
  });

  it("precio inventado (no está en el texto) → false", () => {
    const citation: LlmCitation = {
      priceText: "$99.000",
      currency: "ars",
      vehicleLabel: "Chevrolet Onix o similar",
    };
    expect(isGrounded(citation, rawText)).toBe(false);
  });

  it("vehículo adjudicado incorrectamente (precio real, auto equivocado) → false", () => {
    const citation: LlmCitation = {
      priceText: "$150.000",
      currency: "ars",
      vehicleLabel: "Toyota Corolla",
    };
    expect(isGrounded(citation, rawText)).toBe(false);
  });

  it("el LLM reformatea el precio (agrega espacio) → no matchea, false", () => {
    // Ej.: el texto crudo dice "$150.000" pero el LLM "normaliza" a "$ 150.000".
    const citation: LlmCitation = {
      priceText: "$ 150.000",
      currency: "ars",
      vehicleLabel: "Chevrolet Onix o similar",
    };
    expect(isGrounded(citation, rawText)).toBe(false);
  });
});

describe("resolveGroundedPrice", () => {
  const rawText = "Renault Kwid Iconic — $65.000/día";

  it("cita grounded y parseable → precio resuelto", () => {
    const citation: LlmCitation = { priceText: "$65.000", currency: "ars", vehicleLabel: "Renault Kwid Iconic" };
    expect(resolveGroundedPrice(citation, rawText)).toEqual({ price: 65000, currency: "ars" });
  });

  it("no grounded → null (no se inventa un precio)", () => {
    const citation: LlmCitation = { priceText: "$70.000", currency: "ars", vehicleLabel: "Renault Kwid Iconic" };
    expect(resolveGroundedPrice(citation, rawText)).toBeNull();
  });

  it("grounded pero sin dígitos parseables (ej. \"Consultar\" citado literal) → null", () => {
    const text = "Renault Kwid Iconic — Consultar precio";
    const citation: LlmCitation = { priceText: "Consultar", currency: "ars", vehicleLabel: "Renault Kwid Iconic" };
    expect(resolveGroundedPrice(citation, text)).toBeNull();
  });
});
