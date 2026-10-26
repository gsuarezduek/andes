import { describe, it, expect } from "vitest";
import {
  computeDailyRate,
  parseIdCars,
  isSeasonActiveOn,
  seasonDateRange,
  seasonFromYear,
} from "@/lib/sync/rates";
import type { RawSeason } from "@/lib/sync/types";

// Temporadas de ejemplo (espejan la forma real de VikRentCar):
// - Jul 18 → Ago 2 de 2026, +15%, aplica a idcar 5 y 20.
// - Recurrente (year null), Oct, +30%, aplica a idcar 5.
const SEASONS: RawSeason[] = [
  { from: 17_107_200, to: 18_403_200, year: 2026, diffPercent: 15, idcars: [5, 20] },
  { from: 23_587_200, to: 26_179_200, year: null, diffPercent: 30, idcars: [5] },
];

// 1-dic → 31-ene, recurrente, +20%, idcar 5: cruza fin de año (`to` < `from`).
// (335-1)*86400 (1-dic) y (31-1)*86400 (31-ene) — doy en año no bisiesto.
const YEAR_END_SEASON: RawSeason = {
  from: 28_857_600,
  to: 2_592_000,
  year: null,
  diffPercent: 20,
  idcars: [5],
};

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

describe("isSeasonActiveOn", () => {
  const withYear = { from: 17_107_200, to: 18_403_200, year: 2026 }; // 18-jul → 2-ago 2026
  const recurring = { from: 23_587_200, to: 26_179_200, year: null }; // octubre, todos los años

  it("dentro del rango y año correcto → vigente", () => {
    expect(isSeasonActiveOn(withYear, at("2026-07-20"))).toBe(true);
  });

  it("fuera del rango → no vigente", () => {
    expect(isSeasonActiveOn(withYear, at("2026-07-15"))).toBe(false);
  });

  it("mismo rango pero año distinto → no vigente", () => {
    expect(isSeasonActiveOn(withYear, at("2027-07-20"))).toBe(false);
  });

  it("recurrente (year null) → vigente en cualquier año", () => {
    expect(isSeasonActiveOn(recurring, at("2027-10-15"))).toBe(true);
    expect(isSeasonActiveOn(recurring, at("2030-10-15"))).toBe(true);
  });

  it("los bordes del rango son inclusive", () => {
    expect(isSeasonActiveOn(withYear, at("2026-07-18"))).toBe(true);
    expect(isSeasonActiveOn(withYear, at("2026-08-02"))).toBe(true);
    expect(isSeasonActiveOn(withYear, at("2026-08-03"))).toBe(false);
  });
});

describe("seasonDateRange", () => {
  it("traduce segundos-del-año a fechas reales", () => {
    // 18-jul → 2-ago (verificado en docs/wordpress-mapping.md: 18-jul → 17107200).
    expect(seasonDateRange({ from: 17_107_200, to: 18_403_200 }, 2026)).toEqual({
      start: "2026-07-18",
      end: "2026-08-02",
    });
  });

  it("respeta años bisiestos (el corrimiento post-febrero no se rompe)", () => {
    // Mismo `from`/`to` (oct-ish), en un año bisiesto (2028) vs. no bisiesto.
    const range2027 = seasonDateRange({ from: 23_587_200, to: 26_179_200 }, 2027);
    const range2028 = seasonDateRange({ from: 23_587_200, to: 26_179_200 }, 2028);
    expect(range2027).toEqual({ start: "2027-10-01", end: "2027-10-31" });
    expect(range2028).toEqual({ start: "2028-09-30", end: "2028-10-30" });
  });

  it("temporada que cruza fin de año: `to` cae en el 1° de enero del año siguiente", () => {
    expect(seasonDateRange({ from: 28_857_600, to: 2_592_000 }, 2026)).toEqual({
      start: "2026-12-01",
      end: "2027-01-31",
    });
  });
});

describe("temporadas que cruzan fin de año (ej. 1-dic a 31-ene)", () => {
  it("vigente en diciembre (la 'cola', mismo año que `from`)", () => {
    expect(isSeasonActiveOn(YEAR_END_SEASON, at("2026-12-15"))).toBe(true);
    expect(computeDailyRate(70_000, [YEAR_END_SEASON], 5, at("2026-12-15"))).toBe(84_000);
  });

  it("vigente en enero (la 'cabeza', año siguiente al de `from`)", () => {
    expect(isSeasonActiveOn(YEAR_END_SEASON, at("2027-01-15"))).toBe(true);
    expect(computeDailyRate(70_000, [YEAR_END_SEASON], 5, at("2027-01-15"))).toBe(84_000);
  });

  it("no vigente justo antes (30-nov) ni justo después (1-feb)", () => {
    expect(isSeasonActiveOn(YEAR_END_SEASON, at("2026-11-30"))).toBe(false);
    expect(isSeasonActiveOn(YEAR_END_SEASON, at("2027-02-01"))).toBe(false);
  });

  it("los bordes (1-dic y 31-ene) son inclusive", () => {
    expect(isSeasonActiveOn(YEAR_END_SEASON, at("2026-12-01"))).toBe(true);
    expect(isSeasonActiveOn(YEAR_END_SEASON, at("2027-01-31"))).toBe(true);
  });

  it("seasonFromYear ancla siempre al año de `from`, caiga `now` en dic o en ene", () => {
    expect(seasonFromYear(YEAR_END_SEASON, at("2026-12-15"))).toBe(2026);
    expect(seasonFromYear(YEAR_END_SEASON, at("2027-01-15"))).toBe(2026);
    expect(seasonFromYear(YEAR_END_SEASON, at("2026-11-30"))).toBeNull();
  });

  it("con año fijo, la ocurrencia de dic-2026/ene-2027 no se confunde con otra dic/ene", () => {
    const fixed = { ...YEAR_END_SEASON, year: 2026 };
    expect(isSeasonActiveOn(fixed, at("2026-12-15"))).toBe(true);
    expect(isSeasonActiveOn(fixed, at("2027-01-15"))).toBe(true);
    // Diciembre de OTRO año (2027) o enero de otro año (2026, de la temporada 2025→2026) no aplican.
    expect(isSeasonActiveOn(fixed, at("2027-12-15"))).toBe(false);
    expect(isSeasonActiveOn(fixed, at("2026-01-15"))).toBe(false);
  });
});
