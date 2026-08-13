import { describe, it, expect, vi } from "vitest";

// reports.ts importa prisma; lo mockeamos para poder testear el helper puro
// sin instanciar el cliente.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import {
  recentMonths,
  sortVehicleReports,
  parseReportPeriod,
  reportPeriodParam,
  reportPeriodLabel,
  resolveReportPeriod,
  DEFAULT_REPORT_PERIOD,
  type VehicleReport,
} from "@/lib/reports";

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

describe("DEFAULT_REPORT_PERIOD", () => {
  it("es el mes anterior (cerrado)", () => {
    expect(DEFAULT_REPORT_PERIOD).toEqual({ kind: "month", which: "previous" });
  });
});

describe("parseReportPeriod / reportPeriodParam", () => {
  it("\"prev\" y valores desconocidos caen en el default (mes anterior)", () => {
    expect(parseReportPeriod("prev")).toEqual({ kind: "month", which: "previous" });
    expect(parseReportPeriod(undefined)).toEqual({ kind: "month", which: "previous" });
    expect(parseReportPeriod("cualquier-cosa")).toEqual({ kind: "month", which: "previous" });
  });

  it("\"current\" es este mes", () => {
    expect(parseReportPeriod("current")).toEqual({ kind: "month", which: "current" });
  });

  it("un número válido de MONTH_RANGE_OPTIONS es un rango de meses", () => {
    expect(parseReportPeriod("6")).toEqual({ kind: "months", months: 6 });
  });

  it("un número fuera de las opciones cae en el default", () => {
    expect(parseReportPeriod("5")).toEqual({ kind: "month", which: "previous" });
  });

  it("reportPeriodParam es el inverso de parseReportPeriod", () => {
    for (const raw of ["prev", "current", "3", "6", "12", "24"]) {
      expect(reportPeriodParam(parseReportPeriod(raw))).toBe(raw);
    }
  });
});

describe("resolveReportPeriod", () => {
  const now = new Date("2026-08-13T15:00:00Z");

  it("mes anterior: rango [1/jul, 1/ago) y monthList = [\"2026-07\"]", () => {
    const { start, end, monthList } = resolveReportPeriod({ kind: "month", which: "previous" }, now);
    expect(monthList).toEqual(["2026-07"]);
    expect(start.toISOString()).toBe("2026-07-01T03:00:00.000Z"); // 00:00 Mendoza (UTC-3)
    expect(end.toISOString()).toBe("2026-08-01T03:00:00.000Z");
  });

  it("este mes: arranca el 1/ago y termina en \"now\" (mes en curso)", () => {
    const { start, end, monthList } = resolveReportPeriod({ kind: "month", which: "current" }, now);
    expect(monthList).toEqual(["2026-08"]);
    expect(start.toISOString()).toBe("2026-08-01T03:00:00.000Z");
    expect(end).toBe(now);
  });

  it("rango de N meses: arranca (N-1) meses atrás y termina en \"now\"", () => {
    const { start, end, monthList } = resolveReportPeriod({ kind: "months", months: 3 }, now);
    expect(monthList).toEqual(["2026-06", "2026-07", "2026-08"]);
    expect(start.toISOString()).toBe("2026-06-01T03:00:00.000Z");
    expect(end).toBe(now);
  });
});

describe("reportPeriodLabel", () => {
  const now = new Date("2026-08-13T15:00:00Z");

  it("mes anterior", () => {
    expect(reportPeriodLabel({ kind: "month", which: "previous" }, now)).toBe("julio de 2026");
  });

  it("este mes, marcado como en curso", () => {
    expect(reportPeriodLabel({ kind: "month", which: "current" }, now)).toBe("agosto de 2026 (en curso)");
  });

  it("rango de meses", () => {
    expect(reportPeriodLabel({ kind: "months", months: 12 }, now)).toBe("Últimos 12 meses");
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
