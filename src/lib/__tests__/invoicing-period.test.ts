import { describe, expect, it } from "vitest";
import {
  incomeMonthKey,
  invoiceLogMonthKey,
  invoicingMonthLabel,
  invoicingMonthOptions,
  summarizeInvoicing,
} from "@/lib/invoicing-period";

describe("incomeMonthKey", () => {
  it("usa el mes en hora de Mendoza", () => {
    // 1/11 01:00 UTC = 31/10 22:00 en Mendoza
    expect(incomeMonthKey({ createdAt: new Date("2026-11-01T01:00:00Z") })).toBe("2026-10");
    expect(incomeMonthKey({ createdAt: new Date("2026-11-01T04:00:00Z") })).toBe("2026-11");
  });
});

describe("invoiceLogMonthKey", () => {
  it("toma la fecha pura sin correr por zona horaria", () => {
    expect(invoiceLogMonthKey({ date: new Date("2026-11-01T00:00:00Z") })).toBe("2026-11");
  });
});

describe("invoicingMonthLabel", () => {
  it("formatea mes y año", () => {
    expect(invoicingMonthLabel("2026-11")).toBe("Noviembre 2026");
    expect(invoicingMonthLabel("2025-01")).toBe("Enero 2025");
  });
});

describe("invoicingMonthOptions", () => {
  it("dedupe, ordena del más nuevo al más viejo e incluye el mes actual", () => {
    const opts = invoicingMonthOptions(["2026-09", "2026-10", "2026-09"], new Date("2026-11-08T15:00:00Z"));
    expect(opts.map((o) => o.key)).toEqual(["2026-11", "2026-10", "2026-09"]);
  });
});

describe("summarizeInvoicing", () => {
  it("separa pendiente y facturado por moneda y calcula el avance por cantidad", () => {
    const s = summarizeInvoicing([
      { amount: 100, currency: "ars", invoicedAt: null },
      { amount: 50, currency: "usd", invoicedAt: null },
      { amount: 200, currency: "ars", invoicedAt: new Date() },
      { amount: 300, currency: "ars", invoicedAt: new Date() },
    ]);
    expect(s.pendingTotal).toEqual({ ars: 100, usd: 50 });
    expect(s.invoicedTotal).toEqual({ ars: 500, usd: 0 });
    expect(s.pendingCount).toBe(2);
    expect(s.invoicedCount).toBe(2);
    expect(s.progressPercent).toBe(50);
  });

  it("sin ingresos no hay avance", () => {
    expect(summarizeInvoicing([]).progressPercent).toBeNull();
  });
});
