import { describe, it, expect } from "vitest";
import { extraHourAmount, formatArs, formatMoney, computeBalance, kmPackKm, kmPackAmount, paymentAdjustedAmount } from "@/lib/contract";

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

  it("preserva centavos", () => {
    expect(computeBalance({ total: 100_000.5, sena: 30_000.25, paid: 20_000 })).toBe(50_000.25);
  });
});

describe("extraHourAmount", () => {
  it("deriva el importe de la hora extra del % sobre la tarifa diaria", () => {
    expect(extraHourAmount({ dailyRate: 30_000, extraHourPercent: 10 })).toBe(3_000);
  });

  it("redondea a centavos (preserva decimales)", () => {
    expect(extraHourAmount({ dailyRate: 10_000, extraHourPercent: 3.3 })).toBe(330);
    expect(extraHourAmount({ dailyRate: 999, extraHourPercent: 10 })).toBe(99.9);
  });

  it("devuelve null si falta la tarifa o el porcentaje", () => {
    expect(extraHourAmount({ dailyRate: undefined, extraHourPercent: 10 })).toBeNull();
    expect(extraHourAmount({ dailyRate: 30_000, extraHourPercent: undefined })).toBeNull();
  });
});

describe("kmPackKm", () => {
  it("multiplica los packs por 200 km", () => {
    expect(kmPackKm({ kmPacks: 3 })).toBe(600);
  });

  it("0 si no hay packs cargados", () => {
    expect(kmPackKm({})).toBe(0);
    expect(kmPackKm({ kmPacks: 0 })).toBe(0);
  });
});

describe("kmPackAmount", () => {
  it("packs × precio del pack", () => {
    expect(kmPackAmount({ kmPacks: 3, kmPackPrice: 20_000 })).toBe(60_000);
  });

  it("null si no hay packs o falta el precio", () => {
    expect(kmPackAmount({ kmPacks: 0, kmPackPrice: 20_000 })).toBeNull();
    expect(kmPackAmount({ kmPacks: 3, kmPackPrice: undefined })).toBeNull();
  });
});

describe("paymentAdjustedAmount", () => {
  it("aplica el recargo (%)", () => {
    expect(paymentAdjustedAmount(200_000, 10)).toBe(220_000);
  });

  it("aplica el descuento (% negativo)", () => {
    expect(paymentAdjustedAmount(200_000, -5)).toBe(190_000);
  });

  it("sin condición devuelve el mismo importe", () => {
    expect(paymentAdjustedAmount(200_000)).toBe(200_000);
    expect(paymentAdjustedAmount(200_000, null)).toBe(200_000);
    expect(paymentAdjustedAmount(200_000, 0)).toBe(200_000);
  });
});

describe("formatArs", () => {
  it("formatea números enteros como pesos sin decimales", () => {
    // Usa NBSP entre símbolo y número; comparamos de forma tolerante.
    const out = formatArs(30_000).replace(/\s/g, " ");
    expect(out).toMatch(/\$\s?30\.000/);
  });

  it("muestra los centavos cuando el valor los tiene", () => {
    const out = formatArs(30_000.5).replace(/\s/g, " ");
    expect(out).toMatch(/\$\s?30\.000,5/);
  });

  it("devuelve — para valores nulos o NaN", () => {
    expect(formatArs(null)).toBe("—");
    expect(formatArs(undefined)).toBe("—");
    expect(formatArs(NaN)).toBe("—");
  });
});

describe("formatMoney", () => {
  it("formatea en pesos con $", () => {
    const out = formatMoney(30_000, "ars").replace(/\s/g, " ");
    expect(out).toMatch(/\$\s?30\.000/);
    expect(out).not.toMatch(/US\$/);
  });

  it("formatea en dólares con US$, distinto de pesos", () => {
    const out = formatMoney(200, "usd").replace(/\s/g, " ");
    expect(out).toMatch(/US\$\s?200/);
  });

  it("devuelve — para valores nulos o NaN en cualquier moneda", () => {
    expect(formatMoney(null, "usd")).toBe("—");
    expect(formatMoney(undefined, "ars")).toBe("—");
    expect(formatMoney(NaN, "usd")).toBe("—");
  });
});
