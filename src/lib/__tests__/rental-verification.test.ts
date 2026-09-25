import { describe, expect, it } from "vitest";
import { canVerifyRental, isRentalVerified } from "@/lib/rental-verification";

describe("canVerifyRental", () => {
  it("permite Confirmadas, Activas y Finalizadas", () => {
    expect(canVerifyRental("reserved", true)).toBe(true);
    expect(canVerifyRental("active", true)).toBe(true);
    expect(canVerifyRental("finished", true)).toBe(true);
  });

  it("no permite Pendientes, Canceladas ni en service", () => {
    expect(canVerifyRental("reserved", false)).toBe(false);
    expect(canVerifyRental("cancelled", true)).toBe(false);
    expect(canVerifyRental("out_of_service", true)).toBe(false);
  });
});

describe("isRentalVerified", () => {
  const at = new Date("2026-09-25T12:00:00Z");

  it("verificada solo con verifiedAt y una reserva verificable", () => {
    expect(isRentalVerified({ status: "finished", bookingConfirmed: true, verifiedAt: at })).toBe(true);
    expect(isRentalVerified({ status: "finished", bookingConfirmed: true, verifiedAt: null })).toBe(false);
  });

  it("una marca vieja no se muestra si la reserva dejó de ser verificable", () => {
    expect(isRentalVerified({ status: "reserved", bookingConfirmed: false, verifiedAt: at })).toBe(false);
    expect(isRentalVerified({ status: "cancelled", bookingConfirmed: true, verifiedAt: at })).toBe(false);
  });
});
