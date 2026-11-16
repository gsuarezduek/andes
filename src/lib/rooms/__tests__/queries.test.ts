import { describe, expect, it } from "vitest";
import { countsAsOccupancy, bookingGuestLabel, overlappingBookings } from "../queries";
import type { RoomBookingView } from "../queries";

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

/** Una estadía mínima para los tests de solapamiento. */
function view(over: Partial<RoomBookingView> & { id: string; startDate: string; endDate: string }): RoomBookingView {
  return {
    roomId: "r1",
    source: "manual",
    guestName: null,
    externalLabel: null,
    externalDescription: null,
    isBlock: false,
    status: "confirmed",
    notes: null,
    totalAmount: 0,
    currency: "ars",
    createdAt: new Date("2026-11-01T12:00:00Z"),
    mirrored: false,
    ...over,
  };
}

describe("overlappingBookings", () => {
  const range = { startDate: "2026-11-10", endDate: "2026-11-15" };

  it("dos estadías que se pisan: se avisa, no se impide", () => {
    const other = view({ id: "b2", startDate: "2026-11-12", endDate: "2026-11-18", guestName: "Ana" });
    expect(overlappingBookings([other], range).map((b) => b.id)).toEqual(["b2"]);
  });

  it("la salida de una y la entrada de la otra el mismo día NO se pisan", () => {
    const sale = view({ id: "b2", startDate: "2026-11-05", endDate: "2026-11-10" });
    const entra = view({ id: "b3", startDate: "2026-11-15", endDate: "2026-11-20" });
    expect(overlappingBookings([sale, entra], range)).toEqual([]);
  });

  it("el bloqueo diario de Airbnb no cuenta (era lo que frenaba cargar una reserva de hoy)", () => {
    const hoy = view({ id: "b2", source: "airbnb", isBlock: true, startDate: "2026-11-10", endDate: "2026-11-11" });
    expect(overlappingBookings([hoy], range)).toEqual([]);
  });

  it("un bloqueo cargado a mano sí cuenta (lo decidió el equipo)", () => {
    const limpieza = view({ id: "b2", source: "manual", isBlock: true, startDate: "2026-11-11", endDate: "2026-11-12" });
    expect(overlappingBookings([limpieza], range).map((b) => b.id)).toEqual(["b2"]);
  });

  it("el espejo de otro canal no cuenta (otra fila ya representa esa estadía)", () => {
    const espejo = view({ id: "b2", source: "booking", mirrored: true, startDate: "2026-11-12", endDate: "2026-11-16" });
    expect(overlappingBookings([espejo], range)).toEqual([]);
  });

  it("una cancelada no cuenta", () => {
    const cancelada = view({ id: "b2", status: "cancelled", startDate: "2026-11-12", endDate: "2026-11-16" });
    expect(overlappingBookings([cancelada], range)).toEqual([]);
  });

  it("al editar, la reserva no se pisa consigo misma", () => {
    const propia = view({ id: "b1", startDate: "2026-11-10", endDate: "2026-11-15" });
    expect(overlappingBookings([propia], { ...range, id: "b1" })).toEqual([]);
  });
});
