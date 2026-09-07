import { describe, it, expect } from "vitest";
import {
  parseAvailabilityRange,
  filterAvailableVehicles,
  MAX_AVAILABILITY_RANGE_DAYS,
  MAX_AVAILABILITY_HORIZON_DAYS,
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
