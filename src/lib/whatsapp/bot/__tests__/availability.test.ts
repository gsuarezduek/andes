import { describe, it, expect } from "vitest";
import { secondsIntoYear } from "@/lib/sync/rates";
import { mendozaWallTimeToUtc } from "@/lib/datetime";
import {
  parseAvailabilityRange,
  filterAvailableVehicles,
  isPriceConfirmedForDate,
  estimateBotQuote,
  MAX_AVAILABILITY_RANGE_DAYS,
  MAX_AVAILABILITY_HORIZON_DAYS,
  MAX_PRICE_HORIZON_DAYS,
  type AvailabilityVehicle,
} from "@/lib/whatsapp/bot/availability";

const NOW = new Date("2026-09-07T15:00:00Z"); // mediodía en Mendoza

describe("parseAvailabilityRange", () => {
  it("acepta un rango válido y devuelve instantes UTC", () => {
    const result = parseAvailabilityRange("2026-09-10", "2026-09-15", NOW);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.range.startUtc < result.range.endUtc).toBe(true);
    }
  });

  it("rechaza fechas inválidas", () => {
    const result = parseAvailabilityRange("no-es-una-fecha", "2026-09-15", NOW);
    expect(result.ok).toBe(false);
  });

  it("rechaza un rango invertido", () => {
    const result = parseAvailabilityRange("2026-09-15", "2026-09-10", NOW);
    expect(result.ok).toBe(false);
  });

  it("rechaza una fecha de retiro en el pasado", () => {
    const result = parseAvailabilityRange("2026-09-01", "2026-09-05", NOW);
    expect(result.ok).toBe(false);
  });

  it("acepta hoy mismo como fecha de retiro", () => {
    const result = parseAvailabilityRange("2026-09-07", "2026-09-08", NOW);
    expect(result.ok).toBe(true);
  });

  it(`rechaza un rango de más de ${MAX_AVAILABILITY_RANGE_DAYS} días`, () => {
    const result = parseAvailabilityRange("2026-09-10", "2026-12-10", NOW);
    expect(result.ok).toBe(false);
  });

  it(`rechaza un retiro a más de ${MAX_AVAILABILITY_HORIZON_DAYS} días`, () => {
    const result = parseAvailabilityRange("2027-06-01", "2027-06-05", NOW);
    expect(result.ok).toBe(false);
  });
});

describe("filterAvailableVehicles", () => {
  const range = { startUtc: new Date("2026-09-10T03:00:00Z"), endUtc: new Date("2026-09-15T02:59:00Z") };
  const vehicles: AvailabilityVehicle[] = [
    { id: "v1", brand: "Fiat", model: "Cronos", name: null, dailyRate: 80000 },
    { id: "v2", brand: "Toyota", model: "Hilux", name: "La camioneta", dailyRate: 150000 },
  ];

  it("devuelve todos los vehículos sin reservas que se solapen", () => {
    const result = filterAvailableVehicles(vehicles, [], range);
    expect(result).toHaveLength(2);
  });

  it("excluye un vehículo con una reserva que se solapa", () => {
    const result = filterAvailableVehicles(
      vehicles,
      [{ vehicleId: "v1", startAt: new Date("2026-09-12T00:00:00Z"), endAt: new Date("2026-09-13T00:00:00Z") }],
      range,
    );
    expect(result.map((v) => v.id)).toEqual(["v2"]);
  });

  it("no excluye un vehículo con una reserva fuera del rango", () => {
    const result = filterAvailableVehicles(
      vehicles,
      [{ vehicleId: "v1", startAt: new Date("2026-08-01T00:00:00Z"), endAt: new Date("2026-08-05T00:00:00Z") }],
      range,
    );
    expect(result).toHaveLength(2);
  });

  it("ignora reservas sin vehículo asignado", () => {
    const result = filterAvailableVehicles(
      vehicles,
      [{ vehicleId: null, startAt: new Date("2026-09-12T00:00:00Z"), endAt: new Date("2026-09-13T00:00:00Z") }],
      range,
    );
    expect(result).toHaveLength(2);
  });
});

describe("isPriceConfirmedForDate", () => {
  it("un retiro hoy mismo está dentro de la ventana", () => {
    expect(isPriceConfirmedForDate(new Date("2026-09-07T03:00:00Z"), NOW)).toBe(true);
  });

  it(`un retiro a ${MAX_PRICE_HORIZON_DAYS} días está dentro de la ventana (borde inclusive)`, () => {
    const startUtc = new Date(new Date("2026-09-07T00:00:00-03:00").getTime() + MAX_PRICE_HORIZON_DAYS * 24 * 60 * 60 * 1000);
    expect(isPriceConfirmedForDate(startUtc, NOW)).toBe(true);
  });

  it(`un retiro a más de ${MAX_PRICE_HORIZON_DAYS} días queda sin precio confirmado`, () => {
    const startUtc = new Date(
      new Date("2026-09-07T00:00:00-03:00").getTime() + (MAX_PRICE_HORIZON_DAYS + 1) * 24 * 60 * 60 * 1000,
    );
    expect(isPriceConfirmedForDate(startUtc, NOW)).toBe(false);
  });
});

describe("estimateBotQuote (mismo cálculo que el presupuestador del Calendario)", () => {
  const sec = (day: string) => secondsIntoYear(mendozaWallTimeToUtc(`${day}T12:00`)).seconds;
  // Fin de semana largo 14–16/11 con +20% para el modelo 5.
  const LONG_WEEKEND = { fromSeconds: sec("2026-11-14"), toSeconds: sec("2026-11-16"), year: 2026, diffPercent: 20, carIds: [5] };
  const base = { dailyRate: 80000, wpCarId: 5, now: NOW };

  it("sin temporadas cobra la tarifa por cada noche", () => {
    const q = estimateBotQuote({ ...base, seasonRows: [], startDate: "2026-11-10", endDate: "2026-11-13" });
    expect(q).toEqual({ total: 240000, days: 3, pricePerDay: 80000, seasonalIncrease: false });
  });

  it("aplica el aumento solo a los días que caen en la temporada", () => {
    // Se cobran 13, 14 y 15: 80.000 + 96.000 + 96.000.
    const q = estimateBotQuote({ ...base, seasonRows: [LONG_WEEKEND], startDate: "2026-11-13", endDate: "2026-11-16" });
    expect(q).toEqual({ total: 272000, days: 3, pricePerDay: 90667, seasonalIncrease: true });
  });

  it("no aplica una temporada de otro modelo", () => {
    const q = estimateBotQuote({ ...base, wpCarId: 8, seasonRows: [LONG_WEEKEND], startDate: "2026-11-13", endDate: "2026-11-16" });
    expect(q?.total).toBe(240000);
    expect(q?.seasonalIncrease).toBe(false);
  });

  it("des-aplica la temporada de hoy para reconstruir la tarifa base", () => {
    // Hoy (7/9) hay +10%: dailyRate 88.000 → base 80.000 para fechas sin temporada.
    const today = { fromSeconds: sec("2026-09-01"), toSeconds: sec("2026-09-10"), year: 2026, diffPercent: 10, carIds: [5] };
    const q = estimateBotQuote({ ...base, dailyRate: 88000, seasonRows: [today], startDate: "2026-11-10", endDate: "2026-11-12" });
    expect(q?.total).toBe(160000);
  });

  it("retiro y devolución el mismo día cobran 1 día", () => {
    const q = estimateBotQuote({ ...base, seasonRows: [LONG_WEEKEND], startDate: "2026-11-14", endDate: "2026-11-14" });
    expect(q).toEqual({ total: 96000, days: 1, pricePerDay: 96000, seasonalIncrease: true });
  });

  it("sin tarifa no cotiza", () => {
    expect(estimateBotQuote({ ...base, dailyRate: null, seasonRows: [], startDate: "2026-11-10", endDate: "2026-11-12" })).toBeNull();
  });
});
