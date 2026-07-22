import { describe, it, expect } from "vitest";
import { parseDecimal } from "@/lib/number-input";

describe("parseDecimal", () => {
  it("acepta coma como separador decimal", () => {
    expect(parseDecimal("70,50")).toBe(70.5);
  });

  it("acepta punto como separador decimal", () => {
    expect(parseDecimal("70.50")).toBe(70.5);
  });

  it("acepta enteros", () => {
    expect(parseDecimal("100")).toBe(100);
  });

  it("devuelve undefined para vacío o inválido", () => {
    expect(parseDecimal("")).toBeUndefined();
    expect(parseDecimal(undefined)).toBeUndefined();
    expect(parseDecimal(null)).toBeUndefined();
    expect(parseDecimal("abc")).toBeUndefined();
  });
});
