import { describe, expect, it } from "vitest";
import { canCorrectImportedDates, shouldCancelMissingBooking } from "../dates";

describe("shouldCancelMissingBooking", () => {
  it("cancela una reserva futura que desapareció del feed", () => {
    expect(shouldCancelMissingBooking("2026-11-05", "2026-10-30")).toBe(true);
  });
  it("no cancela el día de entrada (el feed la saca al llegar el huésped)", () => {
    expect(shouldCancelMissingBooking("2026-10-30", "2026-10-30")).toBe(false);
  });
  it("no cancela una estadía en curso ni una terminada", () => {
    expect(shouldCancelMissingBooking("2026-10-27", "2026-10-30")).toBe(false);
    expect(shouldCancelMissingBooking("2026-10-01", "2026-10-30")).toBe(false);
  });
});

describe("canCorrectImportedDates", () => {
  it("no se corrigen las fechas de una estadía que todavía no empezó", () => {
    expect(canCorrectImportedDates("2026-11-20", "2026-11-17")).toBe(false);
  });
  it("se corrigen desde el día de entrada, en curso o terminada", () => {
    expect(canCorrectImportedDates("2026-11-17", "2026-11-17")).toBe(true);
    expect(canCorrectImportedDates("2026-11-13", "2026-11-17")).toBe(true);
  });
});
