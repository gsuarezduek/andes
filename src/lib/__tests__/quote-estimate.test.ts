import { describe, it, expect } from "vitest";
import {
  buildQuoteRange,
  estimateQuoteTotal,
  quoteBillableDays,
  quoteDaysBreakdown,
  quotePricePerDay,
  splitQuoteRange,
  type QuoteDaysBreakdown,
} from "@/lib/quote-estimate";

const NO_SEASON: { diffPercent: number }[] = [];
const days = (n: number) => Array.from({ length: n }, () => NO_SEASON);
const noExtra = (n: number): QuoteDaysBreakdown => ({ days: n, extraHours: 0 });

describe("estimateQuoteTotal", () => {
  it("sin temporadas: multiplica tarifa diaria por días", () => {
    expect(estimateQuoteTotal(30_000, NO_SEASON, days(3), noExtra(3), null)?.total).toBe(90_000);
  });

  it("redondea el resultado", () => {
    expect(estimateQuoteTotal(33_333.33, NO_SEASON, days(3), noExtra(3), null)?.total).toBe(100_000);
  });

  it("devuelve null sin tarifa", () => {
    expect(estimateQuoteTotal(null, NO_SEASON, days(3), noExtra(3), null)).toBeNull();
  });

  it("devuelve null sin días seleccionados", () => {
    expect(estimateQuoteTotal(30_000, NO_SEASON, [], noExtra(3), null)).toBeNull();
  });

  it("un día con temporada +10% dentro del rango cobra ese día más caro", () => {
    // Hoy sin temporada (dailyRate = tarifa base = 140.000); el segundo día
    // del rango tiene +10% → 140.000 + 154.000 = 294.000, no 280.000.
    const total = estimateQuoteTotal(140_000, NO_SEASON, [NO_SEASON, [{ diffPercent: 10 }]], noExtra(2), null);
    expect(total?.total).toBe(294_000);
  });

  it("si HOY ya tiene la temporada activa, reconstruye la base antes de recalcular", () => {
    // dailyRate = 154.000 ya incluye el +10% de hoy → base = 140.000.
    // El presupuesto es para 2 días sin esa temporada → 140.000 × 2 = 280.000.
    const total = estimateQuoteTotal(154_000, [{ diffPercent: 10 }], [NO_SEASON, NO_SEASON], noExtra(2), null);
    expect(total?.total).toBe(280_000);
  });

  it("varias temporadas el mismo día se multiplican entre sí", () => {
    const total = estimateQuoteTotal(100_000, NO_SEASON, [[{ diffPercent: 10 }, { diffPercent: 5 }]], noExtra(1), null);
    expect(total?.total).toBe(115_500); // 100.000 × 1.1 × 1.05
  });

  it("con hora extra configurada (20%), cobra el día completo + % por cada hora de resto", () => {
    // 1 día + 3 horas extra, 20%/hora → 100.000 + 100.000×0.20×3 = 160.000.
    const total = estimateQuoteTotal(100_000, NO_SEASON, days(2), { days: 1, extraHours: 3 }, 20);
    expect(total).toEqual({ total: 160_000, extraAmount: 60_000 });
  });

  it("la hora extra se valora con la temporada del día en que cae (el siguiente a los días completos)", () => {
    const total = estimateQuoteTotal(
      100_000,
      NO_SEASON,
      [NO_SEASON, [{ diffPercent: 10 }]],
      { days: 1, extraHours: 2 },
      20,
    );
    // 1 día sin temporada (100.000) + 2hs × 20% × 110.000 = 100.000 + 44.000.
    expect(total).toEqual({ total: 144_000, extraAmount: 44_000 });
  });

  it("sin % de hora extra configurado, el resto se redondea a día completo (criterio viejo)", () => {
    const total = estimateQuoteTotal(100_000, NO_SEASON, days(2), { days: 1, extraHours: 3 }, null);
    expect(total).toEqual({ total: 200_000, extraAmount: 0 });
  });
});

describe("quoteDaysBreakdown", () => {
  it("24hs exactas: 1 día, sin horas extra", () => {
    expect(quoteDaysBreakdown(new Date("2026-07-18T12:00:00Z"), new Date("2026-07-19T12:00:00Z"))).toEqual(
      noExtra(1),
    );
  });

  it("menos de 24hs: nunca menos de 1 día", () => {
    expect(quoteDaysBreakdown(new Date("2026-07-18T12:00:00Z"), new Date("2026-07-19T08:00:00Z"))).toEqual(
      noExtra(1),
    );
  });

  it("1 día + 2 horas: día completo + 2 horas extra (menos del umbral)", () => {
    expect(quoteDaysBreakdown(new Date("2026-07-18T09:00:00Z"), new Date("2026-07-19T11:00:00Z"))).toEqual({
      days: 1,
      extraHours: 2,
    });
  });

  it("1 día + 5 horas o más: se redondea a 2 días completos, sin resto", () => {
    expect(quoteDaysBreakdown(new Date("2026-07-18T09:00:00Z"), new Date("2026-07-19T14:00:00Z"))).toEqual(
      noExtra(2),
    );
  });

  it("48hs exactas: 2 días, sin horas extra", () => {
    expect(quoteDaysBreakdown(new Date("2026-07-18T09:00:00Z"), new Date("2026-07-20T09:00:00Z"))).toEqual(
      noExtra(2),
    );
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

describe("buildQuoteRange / quoteBillableDays", () => {
  it("sin horarios: medianoche a medianoche del día siguiente al último elegido (días de calendario)", () => {
    const { startAt, endAt } = buildQuoteRange("2026-07-18", "2026-07-19", null, null);
    expect(quoteBillableDays(startAt, endAt)).toBe(2);
  });

  it("retiro y devolución a la misma hora al día siguiente: 1 día, no 2", () => {
    const { startAt, endAt } = buildQuoteRange("2026-07-18", "2026-07-19", "09:00", "09:00");
    expect(quoteBillableDays(startAt, endAt)).toBe(1);
  });

  it("devolución más tarde el mismo día de vuelta: 2 días (un día empezado cuenta entero)", () => {
    const { startAt, endAt } = buildQuoteRange("2026-07-18", "2026-07-19", "09:00", "17:00");
    expect(quoteBillableDays(startAt, endAt)).toBe(2);
  });

  it("solo horario de retiro: la devolución sigue siendo el día entero siguiente al último elegido", () => {
    const sinHorario = buildQuoteRange("2026-07-18", "2026-07-19", null, null);
    const soloRetiro = buildQuoteRange("2026-07-18", "2026-07-19", "09:00", null);
    expect(soloRetiro.endAt).toEqual(sinHorario.endAt);
  });

  it("solo horario de devolución: el retiro sigue siendo medianoche del primer día elegido", () => {
    const sinHorario = buildQuoteRange("2026-07-18", "2026-07-19", null, null);
    const soloDevolucion = buildQuoteRange("2026-07-18", "2026-07-19", null, "09:00");
    expect(soloDevolucion.startAt).toEqual(sinHorario.startAt);
  });

  it("nunca menos de 1 día aunque el rango sea negativo", () => {
    const startAt = new Date("2026-07-18T12:00:00Z");
    const endAt = new Date("2026-07-18T09:00:00Z");
    expect(quoteBillableDays(startAt, endAt)).toBe(1);
  });
});

describe("splitQuoteRange", () => {
  it("es la inversa de buildQuoteRange sin horarios", () => {
    const { startAt, endAt } = buildQuoteRange("2026-07-18", "2026-07-19", null, null);
    expect(splitQuoteRange(startAt, endAt)).toEqual({
      startDayKey: "2026-07-18",
      endDayKey: "2026-07-19",
      pickupTime: "",
      returnTime: "",
    });
  });

  it("es la inversa de buildQuoteRange con ambos horarios cargados", () => {
    const { startAt, endAt } = buildQuoteRange("2026-07-18", "2026-07-19", "09:00", "17:00");
    expect(splitQuoteRange(startAt, endAt)).toEqual({
      startDayKey: "2026-07-18",
      endDayKey: "2026-07-19",
      pickupTime: "09:00",
      returnTime: "17:00",
    });
  });

  it("es la inversa de buildQuoteRange con un solo horario cargado", () => {
    const { startAt, endAt } = buildQuoteRange("2026-07-18", "2026-07-19", "09:00", null);
    expect(splitQuoteRange(startAt, endAt)).toEqual({
      startDayKey: "2026-07-18",
      endDayKey: "2026-07-19",
      pickupTime: "09:00",
      returnTime: "",
    });
  });
});
