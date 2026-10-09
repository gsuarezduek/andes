import { describe, it, expect } from "vitest";
import {
  buildBalanceHistory,
  balanceHistoryFrom,
  resolveBalanceHistoryGranularity,
  parseBalanceHistoryPeriod,
  parseBalanceHistoryGranularity,
  type BalanceEvent,
} from "@/lib/balance-history";

// Mediodía UTC = mismo día calendario en Mendoza (UTC-3) — evita cruces de
// día por el offset, mismo criterio que el resto de los tests de fechas.
function mendozaNoon(ymd: string): Date {
  return new Date(`${ymd}T12:00:00Z`);
}

describe("buildBalanceHistory — diario", () => {
  it("acumula los eventos día a día y mantiene el saldo en los días sin actividad", () => {
    const events: BalanceEvent[] = [
      { date: mendozaNoon("2026-08-01"), ars: 1000, usd: 0 },
      { date: mendozaNoon("2026-08-03"), ars: -200, usd: 0 },
    ];
    const points = buildBalanceHistory(
      events,
      { ars: 0, usd: 0 },
      mendozaNoon("2026-08-01"),
      mendozaNoon("2026-08-04"),
      "daily",
    );
    expect(points).toEqual([
      { date: "2026-08-01", ars: 1000, usd: 0 },
      { date: "2026-08-02", ars: 1000, usd: 0 }, // sin actividad: arrastra el saldo
      { date: "2026-08-03", ars: 800, usd: 0 },
      { date: "2026-08-04", ars: 800, usd: 0 },
    ]);
  });

  it("un día con varios eventos los suma todos antes de mostrar el punto", () => {
    const events: BalanceEvent[] = [
      { date: mendozaNoon("2026-08-01"), ars: 500, usd: 0 },
      { date: mendozaNoon("2026-08-01"), ars: 300, usd: 0 },
    ];
    const points = buildBalanceHistory(events, { ars: 0, usd: 0 }, mendozaNoon("2026-08-01"), mendozaNoon("2026-08-01"), "daily");
    expect(points).toEqual([{ date: "2026-08-01", ars: 800, usd: 0 }]);
  });

  it("eventos anteriores a \"from\" arrancan el primer punto ya con el saldo acumulado", () => {
    const events: BalanceEvent[] = [
      { date: mendozaNoon("2026-07-20"), ars: 5000, usd: 0 }, // antes de la ventana
      { date: mendozaNoon("2026-08-02"), ars: -1000, usd: 0 },
    ];
    const points = buildBalanceHistory(events, { ars: 0, usd: 0 }, mendozaNoon("2026-08-01"), mendozaNoon("2026-08-02"), "daily");
    expect(points).toEqual([
      { date: "2026-08-01", ars: 5000, usd: 0 },
      { date: "2026-08-02", ars: 4000, usd: 0 },
    ]);
  });

  it("el ajuste manual se suma como piso constante en todos los puntos", () => {
    const events: BalanceEvent[] = [{ date: mendozaNoon("2026-08-01"), ars: 100, usd: 0 }];
    const points = buildBalanceHistory(events, { ars: 50, usd: -3 }, mendozaNoon("2026-08-01"), mendozaNoon("2026-08-01"), "daily");
    expect(points).toEqual([{ date: "2026-08-01", ars: 150, usd: -3 }]);
  });

  it("maneja las dos monedas de forma independiente, sin mezclarlas", () => {
    const events: BalanceEvent[] = [
      { date: mendozaNoon("2026-08-01"), ars: 1000, usd: 0 },
      { date: mendozaNoon("2026-08-01"), ars: 0, usd: 200 },
    ];
    const points = buildBalanceHistory(events, { ars: 0, usd: 0 }, mendozaNoon("2026-08-01"), mendozaNoon("2026-08-01"), "daily");
    expect(points).toEqual([{ date: "2026-08-01", ars: 1000, usd: 200 }]);
  });

  it("sin eventos, el saldo queda constante en el ajuste durante toda la ventana", () => {
    const points = buildBalanceHistory([], { ars: 10, usd: 0 }, mendozaNoon("2026-08-01"), mendozaNoon("2026-08-03"), "daily");
    expect(points).toEqual([
      { date: "2026-08-01", ars: 10, usd: 0 },
      { date: "2026-08-02", ars: 10, usd: 0 },
      { date: "2026-08-03", ars: 10, usd: 0 },
    ]);
  });
});

describe("buildBalanceHistory — semanal", () => {
  it("agrupa de lunes a domingo, mostrando el saldo al cierre de cada semana", () => {
    const events: BalanceEvent[] = [
      { date: mendozaNoon("2026-08-11"), ars: 100, usd: 0 }, // martes, semana del 10
      { date: mendozaNoon("2026-08-14"), ars: 50, usd: 0 }, // viernes, semana del 10
      { date: mendozaNoon("2026-08-18"), ars: 20, usd: 0 }, // martes, semana del 17
    ];
    const points = buildBalanceHistory(
      events,
      { ars: 0, usd: 0 },
      mendozaNoon("2026-08-10"), // lunes
      mendozaNoon("2026-08-20"), // jueves (semana incompleta)
      "weekly",
    );
    expect(points).toEqual([
      { date: "2026-08-10", ars: 150, usd: 0 }, // semana del 10: 100+50
      { date: "2026-08-17", ars: 170, usd: 0 }, // semana del 17 (recortada a `to`): +20
    ]);
  });

  it("el lunes de la semana que contiene \"from\" puede caer antes de \"from\" — igual arranca ahí", () => {
    const points = buildBalanceHistory(
      [{ date: mendozaNoon("2026-08-13"), ars: 999, usd: 0 }], // jueves
      { ars: 0, usd: 0 },
      mendozaNoon("2026-08-13"), // jueves — su lunes es el 10
      mendozaNoon("2026-08-13"),
      "weekly",
    );
    expect(points).toEqual([{ date: "2026-08-10", ars: 999, usd: 0 }]);
  });
});

describe("buildBalanceHistory — reconciliación con el saldo final", () => {
  it("el último punto coincide con el ajuste más todos los eventos, tal como lo calcula getOwnAccountBalances", () => {
    const events: BalanceEvent[] = [
      { date: mendozaNoon("2026-01-01"), ars: 10_000, usd: 100 },
      { date: mendozaNoon("2026-05-01"), ars: -2_000, usd: 0 },
      { date: mendozaNoon("2026-08-15"), ars: 500, usd: -10 },
    ];
    const adjustment = { ars: 1_051_754.51, usd: 0 };
    const to = mendozaNoon("2026-08-20");
    const points = buildBalanceHistory(events, adjustment, balanceHistoryFrom(to, 60), to, "daily");
    const last = points[points.length - 1];
    expect(last.ars).toBeCloseTo(1_051_754.51 + 10_000 - 2_000 + 500);
    expect(last.usd).toBeCloseTo(100 - 10);
  });
});

describe("balanceHistoryFrom", () => {
  it("resta (días - 1) para que el rango incluya exactamente esa cantidad de días, \"to\" inclusive", () => {
    const to = mendozaNoon("2026-08-31");
    expect(balanceHistoryFrom(to, 1).toISOString().slice(0, 10)).toBe("2026-08-31");
    expect(balanceHistoryFrom(to, 30).toISOString().slice(0, 10)).toBe("2026-08-02");
  });
});

describe("resolveBalanceHistoryGranularity", () => {
  it("\"12m\" siempre fuerza semanal, sin importar lo pedido", () => {
    expect(resolveBalanceHistoryGranularity("12m", "daily")).toBe("weekly");
    expect(resolveBalanceHistoryGranularity("12m", "weekly")).toBe("weekly");
  });

  it("el resto de los períodos respeta lo pedido", () => {
    expect(resolveBalanceHistoryGranularity("30d", "daily")).toBe("daily");
    expect(resolveBalanceHistoryGranularity("90d", "weekly")).toBe("weekly");
  });
});

describe("parseBalanceHistoryPeriod / parseBalanceHistoryGranularity", () => {
  it("valores válidos se parsean tal cual; el resto cae en el default (60 días, diario)", () => {
    expect(parseBalanceHistoryPeriod("30d")).toBe("30d");
    expect(parseBalanceHistoryPeriod("12m")).toBe("12m");
    expect(parseBalanceHistoryPeriod(undefined)).toBe("60d");
    expect(parseBalanceHistoryPeriod("rara")).toBe("60d");

    expect(parseBalanceHistoryGranularity("weekly")).toBe("weekly");
    expect(parseBalanceHistoryGranularity(undefined)).toBe("daily");
    expect(parseBalanceHistoryGranularity("rara")).toBe("daily");
  });
});
