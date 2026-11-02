import { describe, it, expect } from "vitest";
import { formatSignedAmount, shouldTrackTotalChange, totalDifference } from "@/lib/rental-total-change";
import { addToContractTotal, formatArs } from "@/lib/contract";

const base = {
  status: "active" as const,
  contractTotal: 90_000,
  previousTotal: 100_000,
  nextTotal: 130_000,
  extensionDetected: false,
};

describe("shouldTrackTotalChange", () => {
  it("avisa en activas y finalizadas con contrato", () => {
    expect(shouldTrackTotalChange(base)).toBe(true);
    expect(shouldTrackTotalChange({ ...base, status: "finished" })).toBe(true);
  });

  it("no avisa en reservas sin entregar ni canceladas", () => {
    expect(shouldTrackTotalChange({ ...base, status: "reserved" })).toBe(false);
    expect(shouldTrackTotalChange({ ...base, status: "cancelled" })).toBe(false);
  });

  it("no avisa si falta alguno de los valores", () => {
    expect(shouldTrackTotalChange({ ...base, contractTotal: undefined })).toBe(false);
    expect(shouldTrackTotalChange({ ...base, previousTotal: null })).toBe(false);
    expect(shouldTrackTotalChange({ ...base, nextTotal: null })).toBe(false);
  });

  it("no avisa si el total no cambió o si hay una extensión", () => {
    expect(shouldTrackTotalChange({ ...base, nextTotal: 100_000 })).toBe(false);
    expect(shouldTrackTotalChange({ ...base, extensionDetected: true })).toBe(false);
  });
});

describe("totalDifference", () => {
  it("mantiene el signo y redondea a centavos", () => {
    expect(totalDifference(100, 130.5)).toBe(30.5);
    expect(totalDifference(130.1, 100)).toBe(-30.1);
    expect(Math.abs(totalDifference(0.1 + 0.2, 0.3))).toBe(0);
  });
});

describe("formatSignedAmount", () => {
  it("marca el signo de los dos lados", () => {
    expect(formatSignedAmount(1000, formatArs)).toBe(`+${formatArs(1000)}`);
    expect(formatSignedAmount(-1000, formatArs)).toBe(`-${formatArs(1000)}`);
  });
});

describe("addToContractTotal", () => {
  it("suma y recalcula el saldo con seña y pagos", () => {
    const next = addToContractTotal({ total: 100_000, sena: 10_000, paid: 20_000, balance: 70_000 }, 30_000);
    expect(next.total).toBe(130_000);
    expect(next.balance).toBe(100_000);
  });

  it("resta con un importe negativo", () => {
    const next = addToContractTotal({ total: 100_000, paid: 20_000, balance: 80_000 }, -30_000);
    expect(next.total).toBe(70_000);
    expect(next.balance).toBe(50_000);
  });
});
