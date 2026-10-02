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
  it("usa el nombre del huésped si está cargado", () => {
    expect(bookingGuestLabel({ guestName: "Juan Pérez", externalLabel: null, isBlock: false, source: "airbnb" })).toBe(
      "Juan Pérez",
    );
  });

  it("sin nombre, un bloqueo se llama 'Bloqueado'", () => {
    expect(bookingGuestLabel({ guestName: null, externalLabel: "Airbnb (Not available)", isBlock: true, source: "airbnb" })).toBe(
      "Bloqueado",
    );
  });

  it("sin nombre, una reserva manual se llama 'Reserva directa'", () => {
    expect(bookingGuestLabel({ guestName: null, externalLabel: null, isBlock: false, source: "manual" })).toBe("Reserva directa");
  });

  it("un rótulo genérico del iCal se reemplaza por 'Reserva de {canal}'", () => {
    expect(bookingGuestLabel({ guestName: null, externalLabel: "Reserved", isBlock: false, source: "airbnb" })).toBe(
      "Reserva de Airbnb",
    );
  });

  it("un rótulo no genérico del iCal se muestra tal cual", () => {
    expect(bookingGuestLabel({ guestName: null, externalLabel: "Juan - 2 huéspedes", isBlock: false, source: "booking" })).toBe(
      "Juan - 2 huéspedes",
    );
  });
});
