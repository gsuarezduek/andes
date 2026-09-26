import { describe, expect, it } from "vitest";
import { roomBarGeometry } from "../geometry";
import { assignLanes } from "@/lib/calendar";

describe("roomBarGeometry", () => {
  it("entrada y salida a mediodía", () => {
    // ventana desde el 1/10, estadía 3→5: entra a mediodía del día 3 (col 2) y sale a mediodía del 5 (col 4)
    expect(roomBarGeometry("2026-10-03", "2026-10-05", "2026-10-01", 30)).toEqual({
      startHalf: 5,
      endHalf: 9,
      clippedStart: false,
      clippedEnd: false,
    });
  });
  it("recorta a la ventana", () => {
    const g = roomBarGeometry("2026-09-25", "2026-10-03", "2026-10-01", 5);
    expect(g).toMatchObject({ startHalf: 0, clippedStart: true });
    const h = roomBarGeometry("2026-10-04", "2026-10-20", "2026-10-01", 5);
    expect(h).toMatchObject({ endHalf: 10, clippedEnd: true });
  });
  it("null si no toca la ventana", () => {
    expect(roomBarGeometry("2026-09-01", "2026-09-05", "2026-10-01", 10)).toBeNull();
    expect(roomBarGeometry("2026-11-01", "2026-11-05", "2026-10-01", 10)).toBeNull();
  });
  it("una salida y una entrada el mismo día no comparten carril", () => {
    const a = roomBarGeometry("2026-10-01", "2026-10-04", "2026-10-01", 10)!;
    const b = roomBarGeometry("2026-10-04", "2026-10-06", "2026-10-01", 10)!;
    const { laneCount } = assignLanes([
      { startIndex: a.startHalf, span: a.endHalf - a.startHalf },
      { startIndex: b.startHalf, span: b.endHalf - b.startHalf },
    ]);
    expect(laneCount).toBe(1);
  });
  it("dos estadías que se pisan sí van a carriles distintos", () => {
    const a = roomBarGeometry("2026-10-01", "2026-10-05", "2026-10-01", 10)!;
    const b = roomBarGeometry("2026-10-04", "2026-10-06", "2026-10-01", 10)!;
    const { laneCount } = assignLanes([
      { startIndex: a.startHalf, span: a.endHalf - a.startHalf },
      { startIndex: b.startHalf, span: b.endHalf - b.startHalf },
    ]);
    expect(laneCount).toBe(2);
  });
});
