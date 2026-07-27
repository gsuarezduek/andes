import { describe, it, expect } from "vitest";
import { assignLanes, type CalendarBar } from "@/lib/calendar";

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
