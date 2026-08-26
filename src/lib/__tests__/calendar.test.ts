import { describe, it, expect } from "vitest";
import {
  assignLanes,
  centerOffsetDays,
  daysInMonth,
  normalizeMonth,
  seasonsForDay,
  shiftMonth,
  type CalendarBar,
} from "@/lib/calendar";

const at = (iso: string) => new Date(`${iso}T12:00:00Z`); // 09:00 Mendoza, evita bordes de medianoche

describe("centerOffsetDays", () => {
  it("31 días (default): 35% antes de hoy, 65% después", () => {
    expect(centerOffsetDays(31)).toBe(11); // 11 antes + hoy + 19 después
  });

  it("7 días (semana): 35% antes, 65% después", () => {
    expect(centerOffsetDays(7)).toBe(2); // 2 antes + hoy + 4 después
  });

  it("cantidad par: redondea al entero más cercano", () => {
    expect(centerOffsetDays(30)).toBe(10); // 10 antes + hoy + 19 después
  });

  it("1 día: no hay ventana alrededor, solo hoy", () => {
    expect(centerOffsetDays(1)).toBe(0);
  });
});

describe("normalizeMonth", () => {
  it("acepta un \"YYYY-MM\" válido", () => {
    expect(normalizeMonth("2026-09")).toBe("2026-09");
  });

  it("rechaza mes fuera de rango", () => {
    expect(normalizeMonth("2026-13")).toBeNull();
    expect(normalizeMonth("2026-00")).toBeNull();
  });

  it("rechaza formato inválido o vacío", () => {
    expect(normalizeMonth("2026-9")).toBeNull();
    expect(normalizeMonth("no-es-un-mes")).toBeNull();
    expect(normalizeMonth(undefined)).toBeNull();
  });
});

describe("daysInMonth", () => {
  it("meses de 31/30/28 días", () => {
    expect(daysInMonth("2026-01")).toBe(31);
    expect(daysInMonth("2026-04")).toBe(30);
    expect(daysInMonth("2026-02")).toBe(28);
  });

  it("febrero bisiesto", () => {
    expect(daysInMonth("2028-02")).toBe(29);
  });
});

describe("shiftMonth", () => {
  it("suma y resta meses dentro del mismo año", () => {
    expect(shiftMonth("2026-06", 1)).toBe("2026-07");
    expect(shiftMonth("2026-06", -1)).toBe("2026-05");
  });

  it("cruza de diciembre a enero del año siguiente", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  it("cruza de enero a diciembre del año anterior", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
});

function bar(rentalId: string, startIndex: number, span: number): CalendarBar {
  return {
    rentalId,
    startIndex,
    span,
    clientName: rentalId,
    status: "reserved",
    confirmed: true,
    note: null,
    extraDrivers: [],
    startAt: new Date(),
    endAt: new Date(),
    bookingModel: null,
    activeNotes: [],
    lane: 0,
    paymentAccent: null,
    balance: 0,
  };
}

describe("assignLanes", () => {
  it("sin solapamientos: todas quedan en el carril 0", () => {
    const { bars, laneCount } = assignLanes([bar("a", 0, 2), bar("b", 3, 2), bar("c", 6, 1)]);
    expect(laneCount).toBe(1);
    expect(bars.map((b) => b.lane)).toEqual([0, 0, 0]);
  });

  it("dos que se solapan: la segunda pasa al carril 1", () => {
    const { bars, laneCount } = assignLanes([bar("a", 0, 5), bar("b", 2, 5)]);
    expect(laneCount).toBe(2);
    const byId = Object.fromEntries(bars.map((b) => [b.rentalId, b.lane]));
    expect(byId.a).toBe(0);
    expect(byId.b).toBe(1);
  });

  it("apenas se tocan en el borde (fin = inicio del otro): comparten carril", () => {
    // "a" ocupa columnas 0-2 (startIndex 0, span 3 → endIndex 2); "b" arranca en 3: no comparten columna.
    const { bars, laneCount } = assignLanes([bar("a", 0, 3), bar("b", 3, 2)]);
    expect(laneCount).toBe(1);
    expect(bars.every((b) => b.lane === 0)).toBe(true);
  });

  it("tres solapadas entre sí: usan 3 carriles", () => {
    const { laneCount } = assignLanes([bar("a", 0, 5), bar("b", 1, 5), bar("c", 2, 5)]);
    expect(laneCount).toBe(3);
  });

  it("libera el carril de una barra ya terminada para una posterior", () => {
    // "a" y "b" se solapan (carriles 0 y 1); "c" arranca después de que "a" terminó → reusa el carril 0.
    const { bars, laneCount } = assignLanes([bar("a", 0, 2), bar("b", 1, 5), bar("c", 3, 2)]);
    expect(laneCount).toBe(2);
    const byId = Object.fromEntries(bars.map((b) => [b.rentalId, b.lane]));
    expect(byId.a).toBe(0);
    expect(byId.b).toBe(1);
    expect(byId.c).toBe(0);
  });
});

describe("seasonsForDay", () => {
  // 18-jul → 2-ago 2026, +15% (mismos valores verificados en rates.test.ts).
  const SEASONS = [{ fromSeconds: 17_107_200, toSeconds: 18_403_200, year: 2026, diffPercent: 15 }];

  it("día fuera de la temporada → []", () => {
    expect(seasonsForDay(SEASONS, at("2026-07-15"))).toEqual([]);
  });

  it("día dentro de la temporada → la devuelve con el rango real", () => {
    expect(seasonsForDay(SEASONS, at("2026-07-20"))).toEqual([
      { diffPercent: 15, from: "2026-07-18", to: "2026-08-02" },
    ]);
  });

  it("mismo rango pero otro año (temporada con year fijo) → []", () => {
    expect(seasonsForDay(SEASONS, at("2027-07-20"))).toEqual([]);
  });

  it("dos temporadas activas el mismo día → devuelve ambas", () => {
    const overlapping = [
      { fromSeconds: 17_107_200, toSeconds: 18_403_200, year: 2026, diffPercent: 15 },
      { fromSeconds: 17_107_200, toSeconds: 18_403_200, year: null, diffPercent: 30 },
    ];
    expect(seasonsForDay(overlapping, at("2026-07-20"))).toEqual([
      { diffPercent: 15, from: "2026-07-18", to: "2026-08-02" },
      { diffPercent: 30, from: "2026-07-18", to: "2026-08-02" },
    ]);
  });
});
