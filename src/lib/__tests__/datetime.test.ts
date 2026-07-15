import { describe, it, expect } from "vitest";
import {
  mendozaWallTimeToUtc,
  formatDateInput,
  formatDateTimeInput,
  formatDateTime,
  fromUnixSeconds,
  vikRentCarUnixToUtc,
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

describe("formatDateTimeInput", () => {
  it("formatea un instante UTC como YYYY-MM-DDTHH:mm en hora de Mendoza", () => {
    // 15:00 UTC == 12:00 en Mendoza (UTC−3).
    const d = new Date("2026-07-12T15:00:00.000Z");
    expect(formatDateTimeInput(d)).toBe("2026-07-12T12:00");
  });

  it("round-trip con mendozaWallTimeToUtc conserva el valor del input", () => {
    const wall = "2026-03-01T23:45";
    expect(formatDateTimeInput(mendozaWallTimeToUtc(wall))).toBe(wall);
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

describe("vikRentCarUnixToUtc", () => {
  it("interpreta el timestamp como hora de pared de Mendoza (WP gmt_offset=-3)", () => {
    // ritiro real: 1791543600 == "2026-10-09T11:00:00Z" como epoch crudo, pero
    // esas 11:00 son la hora de pared cargada en WordPress. Debe quedar 14:00Z
    // para que se muestre 11:00 en Mendoza (no 08:00).
    const utc = vikRentCarUnixToUtc(1_791_543_600);
    expect(utc.toISOString()).toBe("2026-10-09T14:00:00.000Z");
    expect(formatDateTime(utc, "es")).toContain("11:00");
  });

  it("round-trip: la hora que muestra Andes coincide con la de pared de WP", () => {
    // 12:00 de pared en WP → 15:00Z → 12:00 mostrado en Mendoza.
    const wallUnix = Date.UTC(2026, 6, 12, 12, 0, 0) / 1000;
    const utc = vikRentCarUnixToUtc(wallUnix);
    expect(formatDateTime(utc, "es")).toContain("12:00");
  });
});
