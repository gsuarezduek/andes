import { describe, it, expect, vi } from "vitest";

// reports.ts importa prisma; lo mockeamos para poder testear el helper puro
// sin instanciar el cliente.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { recentMonths, sortVehicleReports, type VehicleReport } from "@/lib/reports";

describe("recentMonths", () => {
  it("devuelve los N meses hasta el actual, del más viejo al actual", () => {
    expect(recentMonths("2026-02", 3)).toEqual(["2025-12", "2026-01", "2026-02"]);
  });

  it("maneja el cambio de año", () => {
    expect(recentMonths("2026-01", 2)).toEqual(["2025-12", "2026-01"]);
  });

  it("12 meses termina en el mes actual y arranca 11 atrás", () => {
    const months = recentMonths("2026-07", 12);
    expect(months).toHaveLength(12);
    expect(months[0]).toBe("2025-08");
    expect(months[11]).toBe("2026-07");
  });
});

function vehicle(overrides: Partial<VehicleReport>): VehicleReport {
  return {
    id: "v",
    label: "Auto",
    plate: "AA000AA",
    rentals: 0,
    income: 0,
    cost: 0,
    net: 0,
    damages: 0,
    archived: false,
    ...overrides,
  };
}

describe("sortVehicleReports", () => {
  const vehicles = [
    vehicle({ id: "a", rentals: 2, income: 1000, cost: 100, net: 900, damages: 1 }),
    vehicle({ id: "b", rentals: 5, income: 3000, cost: 500, net: 2500, damages: 0 }),
    vehicle({ id: "c", rentals: 1, income: 500, cost: 0, net: 500, damages: 2 }),
  ];

  it("ordena descendente por la columna elegida", () => {
    expect(sortVehicleReports(vehicles, "rentals", "desc").map((v) => v.id)).toEqual(["b", "a", "c"]);
  });

  it("ordena ascendente por la columna elegida", () => {
    expect(sortVehicleReports(vehicles, "damages", "asc").map((v) => v.id)).toEqual(["b", "a", "c"]);
  });

  it("no muta el array original", () => {
    const copy = [...vehicles];
    sortVehicleReports(vehicles, "income", "asc");
    expect(vehicles).toEqual(copy);
  });
});
