import { describe, it, expect } from "vitest";
import { computeDailyRate, parseIdCars } from "@/lib/sync/rates";
import type { RawSeason } from "@/lib/sync/types";

// Temporadas de ejemplo (espejan la forma real de VikRentCar):
// - Jul 18 → Ago 2 de 2026, +15%, aplica a idcar 5 y 20.
// - Recurrente (year null), Oct, +30%, aplica a idcar 5.
const SEASONS: RawSeason[] = [
  { from: 17_107_200, to: 18_403_200, year: 2026, diffPercent: 15, idcars: [5, 20] },
  { from: 23_587_200, to: 26_179_200, year: null, diffPercent: 30, idcars: [5] },
];

// T12:00Z → 09:00 en Mendoza (mismo día), evita bordes de medianoche.
const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe("computeDailyRate", () => {
  it("sin tarifa base → null", () => {
    expect(computeDailyRate(null, SEASONS, 5, at("2026-07-20"))).toBeNull();
  });

  it("fuera de toda temporada → tarifa base", () => {
    // 15-jul-2026 cae antes de la temporada de julio.
    expect(computeDailyRate(70_000, SEASONS, 5, at("2026-07-15"))).toBe(70_000);
  });

  it("dentro de una temporada activa → aplica el porcentaje", () => {
    // 20-jul-2026, idcar 5: +15%.
    expect(computeDailyRate(70_000, SEASONS, 5, at("2026-07-20"))).toBe(80_500);
  });

  it("la temporada no aplica a un modelo fuera de idcars", () => {
    expect(computeDailyRate(70_000, SEASONS, 99, at("2026-07-20"))).toBe(70_000);
  });

  it("una temporada con año fijo no aplica en otro año", () => {
    // Mismo rango de julio pero en 2027: la temporada de julio es year=2026.
    expect(computeDailyRate(70_000, SEASONS, 5, at("2027-07-20"))).toBe(70_000);
  });

  it("una temporada recurrente (year null) aplica en cualquier año", () => {
    // Octubre 2027, idcar 5: +30%.
    expect(computeDailyRate(70_000, SEASONS, 5, at("2027-10-15"))).toBe(91_000);
  });

  it("redondea al entero", () => {
    expect(computeDailyRate(99_999, SEASONS, 5, at("2026-07-20"))).toBe(114_999); // ×1.15
  });
});

describe("parseIdCars", () => {
  it("parsea el formato -8-,-25-,-5-,", () => {
    expect(parseIdCars("-8-,-25-,-5-,")).toEqual([8, 25, 5]);
  });
  it("vacío o null → []", () => {
    expect(parseIdCars("")).toEqual([]);
    expect(parseIdCars(null)).toEqual([]);
  });
});
