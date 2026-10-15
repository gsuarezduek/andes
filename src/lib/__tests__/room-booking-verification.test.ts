import { describe, expect, it } from "vitest";
import { canVerifyRoomBooking, isRoomBookingVerified } from "@/lib/room-booking-verification";

describe("canVerifyRoomBooking", () => {
  it("permite una estadía confirmada", () => {
    expect(canVerifyRoomBooking("confirmed", false)).toBe(true);
  });

  it("no permite canceladas ni bloqueos de disponibilidad", () => {
    expect(canVerifyRoomBooking("cancelled", false)).toBe(false);
    expect(canVerifyRoomBooking("confirmed", true)).toBe(false);
  });
});

describe("isRoomBookingVerified", () => {
  const at = new Date("2026-09-25T12:00:00Z");

  it("verificada solo con verifiedAt y una reserva verificable", () => {
    expect(isRoomBookingVerified({ status: "confirmed", isBlock: false, verifiedAt: at })).toBe(true);
    expect(isRoomBookingVerified({ status: "confirmed", isBlock: false, verifiedAt: null })).toBe(false);
  });

  it("una marca vieja no se muestra si la reserva dejó de ser verificable", () => {
    expect(isRoomBookingVerified({ status: "cancelled", isBlock: false, verifiedAt: at })).toBe(false);
    expect(isRoomBookingVerified({ status: "confirmed", isBlock: true, verifiedAt: at })).toBe(false);
  });
});
