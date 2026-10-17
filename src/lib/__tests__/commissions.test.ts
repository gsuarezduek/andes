import { describe, expect, it } from "vitest";
import { computeCommission, resolveExpenseCommissionConfig, type ExpenseCommissionSource } from "@/lib/commissions";

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

describe("resolveExpenseCommissionConfig", () => {
  const base: ExpenseCommissionSource = {
    expenseCommissionMode: "none",
    commissionPercent: 3.5,
    commissionFixed: 100,
    commissionCategory: { id: "cat-income", name: "Comisiones (ingreso)" },
    expenseCommissionPercent: 2,
    expenseCommissionFixed: 50,
    expenseCommissionCategory: { id: "cat-expense", name: "Comisiones (egreso)" },
  };

  it("'none' no genera comisión", () => {
    expect(resolveExpenseCommissionConfig(base)).toBeNull();
  });

  it("'same' espeja el % / fijo / categoría de la comisión por ingreso", () => {
    expect(resolveExpenseCommissionConfig({ ...base, expenseCommissionMode: "same" })).toEqual({
      percent: 3.5,
      fixed: 100,
      category: { id: "cat-income", name: "Comisiones (ingreso)" },
    });
  });

  it("'custom' usa los campos propios de la comisión por egreso", () => {
    expect(resolveExpenseCommissionConfig({ ...base, expenseCommissionMode: "custom" })).toEqual({
      percent: 2,
      fixed: 50,
      category: { id: "cat-expense", name: "Comisiones (egreso)" },
    });
  });

  it("'same' sin comisión por ingreso configurada no tiene nada que espejar", () => {
    expect(
      resolveExpenseCommissionConfig({
        ...base,
        expenseCommissionMode: "same",
        commissionPercent: null,
        commissionFixed: null,
        commissionCategory: null,
      }),
    ).toEqual({ percent: null, fixed: null, category: null });
  });
});
