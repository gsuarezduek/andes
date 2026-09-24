import { describe, expect, it } from "vitest";
import { computeCommission } from "@/lib/commissions";

describe("computeCommission", () => {
  it("porcentaje sobre el monto", () => {
    expect(computeCommission({ amount: 10_000, currency: "ars" }, { percent: 3.5, fixed: null })).toBe(350);
  });
  it("monto fijo en pesos", () => {
    expect(computeCommission({ amount: 10_000, currency: "ars" }, { percent: null, fixed: 100 })).toBe(100);
  });
  it("porcentaje más fijo se suman", () => {
    expect(computeCommission({ amount: 10_000, currency: "ars" }, { percent: 2, fixed: 50 })).toBe(250);
  });
  it("el fijo (en pesos) no se aplica a un ingreso en dólares; el porcentaje sí", () => {
    expect(computeCommission({ amount: 200, currency: "usd" }, { percent: null, fixed: 100 })).toBeNull();
    expect(computeCommission({ amount: 200, currency: "usd" }, { percent: 5, fixed: 100 })).toBe(10);
  });
  it("sin configuración (o en cero) no hay comisión", () => {
    expect(computeCommission({ amount: 10_000, currency: "ars" }, { percent: null, fixed: null })).toBeNull();
    expect(computeCommission({ amount: 10_000, currency: "ars" }, { percent: 0, fixed: 0 })).toBeNull();
  });
  it("redondea a centavos", () => {
    expect(computeCommission({ amount: 100.01, currency: "ars" }, { percent: 3.33, fixed: null })).toBe(3.33);
  });
});
