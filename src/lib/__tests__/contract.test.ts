import { describe, it, expect } from "vitest";
import {
  extraHourAmount,
  formatArs,
  formatMoney,
  computeBalance,
  guaranteeTotal,
  kmPackKm,
  kmPackAmount,
  kmPackPriceFor,
  paidTotal,
  paymentAdjustedAmount,
  usdPaymentAmounts,
  usdPaymentDetail,
  type RentalPayment,
} from "@/lib/contract";

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

describe("kmPackPriceFor", () => {
  const conditions = { kmPackPrice: 20_000, kmPackPriceTruck: 30_000 };

  it("usa el precio de autos por default", () => {
    expect(kmPackPriceFor(false, conditions)).toBe(20_000);
  });

  it("usa el precio de camionetas si isTruck", () => {
    expect(kmPackPriceFor(true, conditions)).toBe(30_000);
  });

  it("null si el precio correspondiente no está configurado", () => {
    expect(kmPackPriceFor(true, { kmPackPrice: 20_000, kmPackPriceTruck: null })).toBeNull();
    expect(kmPackPriceFor(false, { kmPackPrice: null, kmPackPriceTruck: 30_000 })).toBeNull();
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

function payment(overrides: Partial<RentalPayment>): RentalPayment {
  return { methodName: "Efectivo", amount: 0, adjustedAmount: 0, ...overrides };
}

describe("paidTotal", () => {
  it("suma el importe base de las líneas que no son garantía", () => {
    const payments = [payment({ amount: 10_000, adjustedAmount: 10_000 }), payment({ amount: 5_000, adjustedAmount: 5_000 })];
    expect(paidTotal(payments)).toBe(15_000);
  });

  it("excluye las líneas marcadas como garantía", () => {
    const payments = [
      payment({ amount: 10_000, adjustedAmount: 10_000 }),
      payment({ amount: 50_000, adjustedAmount: 50_000, isGuarantee: true }),
    ];
    expect(paidTotal(payments)).toBe(10_000);
  });

  it("0 sin pagos", () => {
    expect(paidTotal([])).toBe(0);
  });
});

describe("guaranteeTotal", () => {
  it("suma solo las líneas marcadas como garantía", () => {
    const payments = [
      payment({ amount: 10_000, adjustedAmount: 10_000 }),
      payment({ amount: 50_000, adjustedAmount: 50_000, isGuarantee: true }),
      payment({ amount: 20_000, adjustedAmount: 20_000, isGuarantee: true }),
    ];
    expect(guaranteeTotal(payments)).toBe(70_000);
  });

  it("0 sin garantías", () => {
    expect(guaranteeTotal([payment({ amount: 10_000, adjustedAmount: 10_000 })])).toBe(0);
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

describe("usdPaymentAmounts", () => {
  it("convierte los dólares a pesos a la cotización pactada", () => {
    expect(usdPaymentAmounts(500, 1_500)).toEqual({ amount: 750_000, adjustedAmount: 750_000, usdAdjusted: 500 });
  });

  it("aplica el % del medio de pago sobre los dólares", () => {
    expect(usdPaymentAmounts(100, 1_500, 10)).toEqual({ amount: 150_000, adjustedAmount: 165_000, usdAdjusted: 110 });
  });

  it("una línea en dólares suma a Paga su equivalente en pesos", () => {
    const usd = usdPaymentAmounts(500, 1_500);
    const line = payment({ amount: usd.amount, adjustedAmount: usd.adjustedAmount, usdAmount: 500, exchangeRate: 1_500 });
    expect(paidTotal([payment({ amount: 100_000, adjustedAmount: 100_000 }), line])).toBe(850_000);
  });
});

describe("usdPaymentDetail", () => {
  it("describe cuántos dólares y a qué cotización", () => {
    const detail = usdPaymentDetail({ usdAmount: 500, exchangeRate: 1_500 });
    expect(detail).toContain("500");
    expect(detail).toContain("1.500");
    expect(detail).toContain("×");
  });

  it("null en una línea en pesos", () => {
    expect(usdPaymentDetail({})).toBeNull();
  });
});
