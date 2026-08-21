import { describe, it, expect } from "vitest";
import { sumByCurrency, emptyCurrencyTotals } from "@/lib/currency";

describe("emptyCurrencyTotals", () => {
  it("arranca en cero para ambas monedas", () => {
    expect(emptyCurrencyTotals()).toEqual({ ars: 0, usd: 0 });
  });
});

describe("sumByCurrency", () => {
  it("suma cada moneda por separado, nunca entre sí", () => {
    const totals = sumByCurrency([
      { currency: "ars", amount: 100_000 },
      { currency: "ars", amount: 50_000 },
      { currency: "usd", amount: 200 },
    ]);
    expect(totals).toEqual({ ars: 150_000, usd: 200 });
  });

  it("lista vacía da todo en cero", () => {
    expect(sumByCurrency([])).toEqual({ ars: 0, usd: 0 });
  });

  it("solo usd no deja rastro en ars", () => {
    expect(sumByCurrency([{ currency: "usd", amount: 500 }])).toEqual({ ars: 0, usd: 500 });
  });
});
