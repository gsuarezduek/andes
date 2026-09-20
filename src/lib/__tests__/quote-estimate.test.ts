import { describe, it, expect } from "vitest";
import { estimateQuoteTotal } from "@/lib/quote-estimate";

describe("estimateQuoteTotal", () => {
  it("multiplica tarifa diaria por días", () => {
    expect(estimateQuoteTotal(30_000, 3)).toBe(90_000);
  });

  it("redondea el resultado", () => {
    expect(estimateQuoteTotal(33_333.33, 3)).toBe(100_000);
  });

  it("devuelve null sin tarifa", () => {
    expect(estimateQuoteTotal(null, 3)).toBeNull();
  });

  it("devuelve null con 0 o menos días", () => {
    expect(estimateQuoteTotal(30_000, 0)).toBeNull();
    expect(estimateQuoteTotal(30_000, -1)).toBeNull();
  });
});
