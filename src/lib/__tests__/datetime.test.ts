import { describe, it, expect } from "vitest";
import {
  mendozaWallTimeToUtc,
  formatDateInput,
  formatDateTime,
  fromUnixSeconds,
} from "@/lib/datetime";

describe("mendozaWallTimeToUtc", () => {
  it("interpreta la hora de pared de Mendoza (UTC−3) y devuelve UTC", () => {
    const utc = mendozaWallTimeToUtc("2026-07-12T12:00");
    // Mendoza es UTC−3 → 12:00 local == 15:00 UTC.
    expect(utc.toISOString()).toBe("2026-07-12T15:00:00.000Z");
  });

  it("round-trip: convertir a UTC y volver a mostrar en Mendoza conserva la hora", () => {
    const utc = mendozaWallTimeToUtc("2026-01-05T09:30");
    // El separador entre fecha y hora varía según la versión de ICU (coma o no).
    const shown = formatDateTime(utc, "es");
    expect(shown).toContain("05/01/2026");
    expect(shown).toContain("09:30");
  });
});

describe("formatDateInput", () => {
  it("formatea un instante UTC como YYYY-MM-DD en hora de Mendoza", () => {
    // 02:00 UTC del día 13 es aún el día 12 a las 23:00 en Mendoza.
    const d = new Date("2026-07-13T02:00:00.000Z");
    expect(formatDateInput(d)).toBe("2026-07-12");
  });
});

describe("fromUnixSeconds", () => {
  it("convierte segundos Unix (VikRentCar) a Date", () => {
    expect(fromUnixSeconds(0).toISOString()).toBe("1970-01-01T00:00:00.000Z");
    expect(fromUnixSeconds(1_752_000_000).getTime()).toBe(1_752_000_000_000);
  });
});
