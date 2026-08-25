import { describe, it, expect } from "vitest";
import {
  mondayOf,
  parseCashPeriod,
  cashPeriodSearch,
  resolveCashPeriod,
  DEFAULT_CASH_PERIOD,
} from "@/lib/cash-period";

describe("mondayOf", () => {
  it("un jueves cae en el lunes de esa misma semana", () => {
    expect(mondayOf("2026-08-13")).toBe("2026-08-10"); // jueves → lunes
  });

  it("un lunes es su propio lunes", () => {
    expect(mondayOf("2026-08-10")).toBe("2026-08-10");
  });

  it("un domingo cae en el lunes de la misma semana (no la siguiente)", () => {
    expect(mondayOf("2026-08-16")).toBe("2026-08-10"); // domingo
  });

  it("maneja el cruce de mes", () => {
    expect(mondayOf("2026-08-02")).toBe("2026-07-27"); // domingo 2/ago → lunes 27/jul
  });
});

describe("DEFAULT_CASH_PERIOD", () => {
  it("es hoy", () => {
    expect(DEFAULT_CASH_PERIOD).toEqual({ kind: "today" });
  });
});

describe("parseCashPeriod / cashPeriodSearch", () => {
  it("valores desconocidos o ausentes caen en el default (hoy)", () => {
    expect(parseCashPeriod(undefined, undefined)).toEqual({ kind: "today" });
    expect(parseCashPeriod("cualquier-cosa", undefined)).toEqual({ kind: "today" });
  });

  it("\"week\", \"month\" y \"previous_month\" se parsean directo", () => {
    expect(parseCashPeriod("week", undefined)).toEqual({ kind: "week" });
    expect(parseCashPeriod("month", undefined)).toEqual({ kind: "month" });
    expect(parseCashPeriod("previous_month", undefined)).toEqual({ kind: "previous_month" });
  });

  it("\"date\" con from/to válidos se parsea como rango", () => {
    expect(parseCashPeriod("date", "2026-08-10", "2026-08-13")).toEqual({
      kind: "date",
      from: "2026-08-10",
      to: "2026-08-13",
    });
  });

  it("\"date\" sin \"to\" (o con formato inválido) usa \"from\" para los dos extremos — un solo día", () => {
    expect(parseCashPeriod("date", "2026-08-13")).toEqual({ kind: "date", from: "2026-08-13", to: "2026-08-13" });
    expect(parseCashPeriod("date", "2026-08-13", "13/08/2026")).toEqual({
      kind: "date",
      from: "2026-08-13",
      to: "2026-08-13",
    });
  });

  it("\"date\" con \"to\" antes que \"from\" (invertidas) usa \"from\" para los dos extremos", () => {
    expect(parseCashPeriod("date", "2026-08-13", "2026-08-01")).toEqual({
      kind: "date",
      from: "2026-08-13",
      to: "2026-08-13",
    });
  });

  it("\"date\" sin fecha (o con formato inválido) cae en el default", () => {
    expect(parseCashPeriod("date", undefined)).toEqual({ kind: "today" });
    expect(parseCashPeriod("date", "13/08/2026")).toEqual({ kind: "today" });
  });

  it("cashPeriodSearch es el inverso de parseCashPeriod", () => {
    for (const raw of [
      { kind: "today" },
      { kind: "week" },
      { kind: "month" },
      { kind: "previous_month" },
      { kind: "date", from: "2026-08-13", to: "2026-08-13" },
      { kind: "date", from: "2026-08-10", to: "2026-08-13" },
    ] as const) {
      const search = cashPeriodSearch(raw);
      const params = new URLSearchParams(search);
      expect(
        parseCashPeriod(params.get("period") ?? undefined, params.get("from") ?? undefined, params.get("to") ?? undefined),
      ).toEqual(raw);
    }
  });
});

describe("resolveCashPeriod", () => {
  const now = new Date("2026-08-13T15:00:00Z"); // jueves, 12:00 Mendoza

  it("hoy: rango [13/ago 00:00, 14/ago 00:00) hora Mendoza", () => {
    const { start, end, label } = resolveCashPeriod({ kind: "today" }, now);
    expect(start.toISOString()).toBe("2026-08-13T03:00:00.000Z");
    expect(end.toISOString()).toBe("2026-08-14T03:00:00.000Z");
    expect(label).toBe("Hoy");
  });

  it("esta semana: lunes a lunes siguiente (7 días), con la fecha en el label", () => {
    const { start, end, label } = resolveCashPeriod({ kind: "week" }, now);
    expect(start.toISOString()).toBe("2026-08-10T03:00:00.000Z"); // lunes
    expect(end.toISOString()).toBe("2026-08-17T03:00:00.000Z"); // lunes siguiente
    expect(label).toBe("Esta semana (10/08/2026 – 16/08/2026)");
  });

  it("este mes: 1º del mes a 1º del siguiente", () => {
    const { start, end, label } = resolveCashPeriod({ kind: "month" }, now);
    expect(start.toISOString()).toBe("2026-08-01T03:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-01T03:00:00.000Z");
    expect(label).toBe("Este mes");
  });

  it("mes anterior: 1º del mes previo a 1º del actual, con el nombre del mes en el label", () => {
    const { start, end, label } = resolveCashPeriod({ kind: "previous_month" }, now);
    expect(start.toISOString()).toBe("2026-07-01T03:00:00.000Z");
    expect(end.toISOString()).toBe("2026-08-01T03:00:00.000Z");
    expect(label).toBe("Mes anterior (Julio)");
  });

  it("mes anterior maneja el cruce de año (\"now\" en enero → diciembre del año previo)", () => {
    const nowJanuary = new Date("2026-01-13T15:00:00Z");
    const { start, end, label } = resolveCashPeriod({ kind: "previous_month" }, nowJanuary);
    expect(start.toISOString()).toBe("2025-12-01T03:00:00.000Z");
    expect(end.toISOString()).toBe("2026-01-01T03:00:00.000Z");
    expect(label).toBe("Mes anterior (Diciembre)");
  });

  it("fecha puntual (from === to): ese día completo, sin depender de `now`", () => {
    const { start, end, label } = resolveCashPeriod({ kind: "date", from: "2026-01-05", to: "2026-01-05" }, now);
    expect(start.toISOString()).toBe("2026-01-05T03:00:00.000Z");
    expect(end.toISOString()).toBe("2026-01-06T03:00:00.000Z");
    expect(label).toBe("05/01/2026");
  });

  it("rango de fechas: desde el 00:00 de \"from\" hasta el 00:00 del día siguiente a \"to\"", () => {
    const { start, end, label } = resolveCashPeriod({ kind: "date", from: "2026-01-05", to: "2026-01-08" }, now);
    expect(start.toISOString()).toBe("2026-01-05T03:00:00.000Z");
    expect(end.toISOString()).toBe("2026-01-09T03:00:00.000Z");
    expect(label).toBe("05/01/2026 – 08/01/2026");
  });
});
