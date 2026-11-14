import { describe, expect, it } from "vitest";
import { countsAsOccupancy, bookingGuestLabel } from "../queries";

describe("countsAsOccupancy", () => {
  it("una reserva normal (no bloqueo) cuenta", () => {
    expect(countsAsOccupancy({ isBlock: false, source: "airbnb" })).toBe(true);
  });

  it("un bloqueo cargado a mano en Andes cuenta (lo decidió el equipo a propósito)", () => {
    expect(countsAsOccupancy({ isBlock: true, source: "manual" })).toBe(true);
  });

  it("un bloqueo que llega por sync de Airbnb NO cuenta", () => {
    expect(countsAsOccupancy({ isBlock: true, source: "airbnb" })).toBe(false);
  });

  it("un bloqueo que llega por sync de Booking NO cuenta", () => {
    expect(countsAsOccupancy({ isBlock: true, source: "booking" })).toBe(false);
  });
});

describe("bookingGuestLabel", () => {
  it("con nombre, la plataforma va adelante", () => {
    expect(bookingGuestLabel({ guestName: "Sofía Müller", externalLabel: "CLOSED - Not available", isBlock: false, source: "booking" })).toBe(
      "Booking: Sofía Müller",
    );
    expect(bookingGuestLabel({ guestName: "Juan Pérez", externalLabel: null, isBlock: false, source: "airbnb" })).toBe(
      "Airbnb: Juan Pérez",
    );
  });

  it("sin nombre y con un rótulo genérico del iCal → '{canal}: sin nombre'", () => {
    expect(bookingGuestLabel({ guestName: null, externalLabel: "Reserved", isBlock: false, source: "airbnb" })).toBe(
      "Airbnb: sin nombre",
    );
    expect(bookingGuestLabel({ guestName: "  ", externalLabel: "CLOSED - Not available", isBlock: false, source: "booking" })).toBe(
      "Booking: sin nombre",
    );
  });

  it("un rótulo no genérico del iCal se usa como nombre", () => {
    expect(bookingGuestLabel({ guestName: null, externalLabel: "Juan - 2 huéspedes", isBlock: false, source: "booking" })).toBe(
      "Booking: Juan - 2 huéspedes",
    );
  });

  it("sin nombre, un bloqueo se llama 'Bloqueado'", () => {
    expect(bookingGuestLabel({ guestName: null, externalLabel: "Airbnb (Not available)", isBlock: true, source: "airbnb" })).toBe(
      "Bloqueado",
    );
  });

  it("una reserva directa va solo con el nombre", () => {
    expect(bookingGuestLabel({ guestName: "Ana", externalLabel: null, isBlock: false, source: "manual" })).toBe("Ana");
    expect(bookingGuestLabel({ guestName: null, externalLabel: null, isBlock: false, source: "manual" })).toBe("Reserva directa");
  });
});
