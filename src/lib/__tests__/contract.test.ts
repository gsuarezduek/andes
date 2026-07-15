import { describe, it, expect } from "vitest";
import { extraHourAmount, formatArs, computeBalance } from "@/lib/contract";

describe("computeBalance", () => {
  it("saldo = total − seña − paga", () => {
    expect(computeBalance({ total: 100_000, sena: 30_000, paid: 20_000 })).toBe(50_000);
  });

  it("trata seña/paga faltantes como 0", () => {
    expect(computeBalance({ total: 100_000 })).toBe(100_000);
    expect(computeBalance({ total: 100_000, sena: 40_000 })).toBe(60_000);
  });

  it("devuelve null si no hay total", () => {
    expect(computeBalance({ sena: 10_000, paid: 5_000 })).toBeNull();
    expect(computeBalance({ total: undefined })).toBeNull();
  });
});

describe("extraHourAmount", () => {
  it("deriva el importe de la hora extra del % sobre la tarifa diaria", () => {
    expect(extraHourAmount({ dailyRate: 30_000, extraHourPercent: 10 })).toBe(3_000);
  });

  it("redondea al entero", () => {
    expect(extraHourAmount({ dailyRate: 10_000, extraHourPercent: 3.3 })).toBe(330);
    expect(extraHourAmount({ dailyRate: 999, extraHourPercent: 10 })).toBe(100); // 99.9 → 100
  });

  it("devuelve null si falta la tarifa o el porcentaje", () => {
    expect(extraHourAmount({ dailyRate: undefined, extraHourPercent: 10 })).toBeNull();
    expect(extraHourAmount({ dailyRate: 30_000, extraHourPercent: undefined })).toBeNull();
  });
});

describe("formatArs", () => {
  it("formatea números como pesos sin decimales", () => {
    // Usa NBSP entre símbolo y número; comparamos de forma tolerante.
    const out = formatArs(30_000).replace(/\s/g, " ");
    expect(out).toMatch(/\$\s?30\.000/);
  });

  it("devuelve — para valores nulos o NaN", () => {
    expect(formatArs(null)).toBe("—");
    expect(formatArs(undefined)).toBe("—");
    expect(formatArs(NaN)).toBe("—");
  });
});
