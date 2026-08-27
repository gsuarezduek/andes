import { describe, it, expect } from "vitest";
import { resolveOffsetsToWindows } from "../settings";

const at = (iso: string) => new Date(`${iso}T15:00:00Z`); // 12:00 Mendoza, evita bordes de medianoche

describe("resolveOffsetsToWindows", () => {
  it("hoy/+30/+60 con duración de 3 días", () => {
    const windows = resolveOffsetsToWindows([0, 30, 60], 3, at("2026-08-27"));
    expect(windows).toHaveLength(3);

    expect(windows[0].offsetDays).toBe(0);
    expect(windows[0].pickupDate.toISOString()).toBe("2026-08-27T03:00:00.000Z"); // 00:00 Mendoza = 03:00Z
    expect(windows[0].days).toBe(3);
    expect(windows[0].returnDate.getTime() - windows[0].pickupDate.getTime()).toBe(3 * 86_400_000);

    expect(windows[1].offsetDays).toBe(30);
    expect(windows[1].pickupDate.toISOString()).toBe("2026-09-26T03:00:00.000Z");

    expect(windows[2].offsetDays).toBe(60);
    expect(windows[2].pickupDate.toISOString()).toBe("2026-10-26T03:00:00.000Z");
  });

  it("duración configurable (no hardcodeada)", () => {
    const windows = resolveOffsetsToWindows([0], 5, at("2026-08-27"));
    expect(windows[0].days).toBe(5);
    expect(windows[0].returnDate.getTime() - windows[0].pickupDate.getTime()).toBe(5 * 86_400_000);
  });

  it("offsets vacíos → sin ventanas", () => {
    expect(resolveOffsetsToWindows([], 3, at("2026-08-27"))).toEqual([]);
  });

  it("offset 0 empieza siempre a medianoche de hoy, sin importar la hora actual", () => {
    const morning = resolveOffsetsToWindows([0], 3, new Date("2026-08-27T11:30:00Z")); // 08:30 Mendoza
    const evening = resolveOffsetsToWindows([0], 3, new Date("2026-08-27T23:30:00Z")); // 20:30 Mendoza
    expect(morning[0].pickupDate.toISOString()).toBe(evening[0].pickupDate.toISOString());
  });
});
