import { describe, expect, it } from "vitest";
import { fundBalance, fundBalanceAtMonthEnd, type FundMovementAmount } from "@/lib/investment-funds";

// Mediodía Mendoza explícito (offset -03:00) para no depender de la hora del
// sistema ni cruzar de mes por la conversión a hora local (ver
// `provider-ledger-grouping.test.ts`, mismo patrón).
function m(partial: Partial<Omit<FundMovementAmount, "createdAt">> & { createdAtMendoza: string }): FundMovementAmount {
  const { createdAtMendoza, ...rest } = partial;
  return {
    type: "deposit",
    amount: 0,
    currency: "ars",
    ...rest,
    createdAt: new Date(`${createdAtMendoza}T12:00:00-03:00`),
  };
}

describe("fundBalance", () => {
  it("suma depósitos y resta retiros, por moneda", () => {
    const totals = fundBalance([
      m({ type: "deposit", amount: 1000, currency: "ars", createdAtMendoza: "2026-01-05" }),
      m({ type: "withdrawal", amount: 300, currency: "ars", createdAtMendoza: "2026-01-10" }),
      m({ type: "deposit", amount: 100, currency: "usd", createdAtMendoza: "2026-01-15" }),
    ]);
    expect(totals).toEqual({ ars: 700, usd: 100 });
  });

  it("sin movimientos da 0", () => {
    expect(fundBalance([])).toEqual({ ars: 0, usd: 0 });
  });
});

describe("fundBalanceAtMonthEnd", () => {
  const movements = [
    m({ type: "deposit", amount: 1000, currency: "ars", createdAtMendoza: "2026-07-10" }),
    m({ type: "deposit", amount: 500, currency: "ars", createdAtMendoza: "2026-08-05" }),
    m({ type: "withdrawal", amount: 200, currency: "ars", createdAtMendoza: "2026-09-01" }),
  ];

  it("solo cuenta movimientos hasta el fin de ese mes", () => {
    expect(fundBalanceAtMonthEnd(movements, "2026-07")).toEqual({ ars: 1000, usd: 0 });
    expect(fundBalanceAtMonthEnd(movements, "2026-08")).toEqual({ ars: 1500, usd: 0 });
    expect(fundBalanceAtMonthEnd(movements, "2026-09")).toEqual({ ars: 1300, usd: 0 });
  });

  it("un mes anterior al primer movimiento da 0", () => {
    expect(fundBalanceAtMonthEnd(movements, "2026-06")).toEqual({ ars: 0, usd: 0 });
  });
});
