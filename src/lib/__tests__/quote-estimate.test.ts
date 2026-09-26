import { describe, it, expect } from "vitest";
import { estimateQuoteTotal, quotePricePerDay } from "@/lib/quote-estimate";

const NO_SEASON: { diffPercent: number }[] = [];
const days = (n: number) => Array.from({ length: n }, () => NO_SEASON);

describe("estimateQuoteTotal", () => {
  it("sin temporadas: multiplica tarifa diaria por días", () => {
    expect(estimateQuoteTotal(30_000, NO_SEASON, days(3))).toBe(90_000);
  });

  it("redondea el resultado", () => {
    expect(estimateQuoteTotal(33_333.33, NO_SEASON, days(3))).toBe(100_000);
  });

  it("devuelve null sin tarifa", () => {
    expect(estimateQuoteTotal(null, NO_SEASON, days(3))).toBeNull();
  });

  it("devuelve null sin días seleccionados", () => {
    expect(estimateQuoteTotal(30_000, NO_SEASON, [])).toBeNull();
  });

  it("un día con temporada +10% dentro del rango cobra ese día más caro", () => {
    // Hoy sin temporada (dailyRate = tarifa base = 140.000); el segundo día
    // del rango tiene +10% → 140.000 + 154.000 = 294.000, no 280.000.
    const total = estimateQuoteTotal(140_000, NO_SEASON, [NO_SEASON, [{ diffPercent: 10 }]]);
    expect(total).toBe(294_000);
  });

  it("si HOY ya tiene la temporada activa, reconstruye la base antes de recalcular", () => {
    // dailyRate = 154.000 ya incluye el +10% de hoy → base = 140.000.
    // El presupuesto es para 2 días sin esa temporada → 140.000 × 2 = 280.000.
    const total = estimateQuoteTotal(154_000, [{ diffPercent: 10 }], [NO_SEASON, NO_SEASON]);
    expect(total).toBe(280_000);
  });

  it("varias temporadas el mismo día se multiplican entre sí", () => {
    const total = estimateQuoteTotal(100_000, NO_SEASON, [[{ diffPercent: 10 }, { diffPercent: 5 }]]);
    expect(total).toBe(115_500); // 100.000 × 1.1 × 1.05
  });
});

describe("quotePricePerDay", () => {
  it("divide el total por los días", () => {
    expect(quotePricePerDay(90_000, 3)).toBe(30_000);
  });

  it("redondea al peso entero", () => {
    expect(quotePricePerDay(100_000, 3)).toBe(33_333);
  });

  it("devuelve null sin total, con total inválido o sin días", () => {
    expect(quotePricePerDay(null, 3)).toBeNull();
    expect(quotePricePerDay(Number.NaN, 3)).toBeNull();
    expect(quotePricePerDay(0, 3)).toBeNull();
    expect(quotePricePerDay(90_000, 0)).toBeNull();
  });
});
