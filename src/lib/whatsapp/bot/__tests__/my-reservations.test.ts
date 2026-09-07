import { describe, it, expect } from "vitest";
import { summarizeReservation } from "@/lib/whatsapp/bot/my-reservations";

describe("summarizeReservation", () => {
  it("marca como estimado (isEstimate) una reserva sin contrato todavía, usando los datos de referencia de VikRentCar", () => {
    const summary = summarizeReservation({
      wpBookingId: 1234,
      status: "reserved",
      bookingConfirmed: true,
      startAt: new Date("2026-09-10T13:00:00Z"),
      endAt: new Date("2026-09-15T13:00:00Z"),
      pricing: null,
      bookingTotal: 400000 as never,
      bookingPaid: 100000 as never,
      vehicle: { brand: "Fiat", model: "Cronos", name: null },
    });
    expect(summary.bookingNumber).toBe(1234);
    expect(summary.statusLabel).toBe("Confirmado");
    expect(summary.vehicle).toBe("Fiat Cronos");
    expect(summary.isEstimate).toBe(true);
    expect(summary.totalRef).toBe(400000);
    expect(summary.paidSoFar).toBe(100000);
    expect(summary.balance).toBe(300000);
  });

  it("usa el contrato real (no estimado) cuando ya hubo entrega", () => {
    const summary = summarizeReservation({
      wpBookingId: 5678,
      status: "active",
      bookingConfirmed: true,
      startAt: new Date("2026-09-01T13:00:00Z"),
      endAt: new Date("2026-09-05T13:00:00Z"),
      pricing: { total: 300000, sena: 50000, paid: 50000, balance: 200000 } as never,
      bookingTotal: null,
      bookingPaid: null,
      vehicle: { brand: "Toyota", model: "Hilux", name: "La camioneta" },
    });
    expect(summary.statusLabel).toBe("Activo");
    expect(summary.vehicle).toBe("La camioneta");
    expect(summary.isEstimate).toBe(false);
    expect(summary.totalRef).toBe(300000);
    expect(summary.paidSoFar).toBe(100000);
    expect(summary.balance).toBe(200000);
  });

  it("marca 'Pendiente' una reserva sin confirmar", () => {
    const summary = summarizeReservation({
      wpBookingId: null,
      status: "reserved",
      bookingConfirmed: false,
      startAt: new Date("2026-09-10T13:00:00Z"),
      endAt: new Date("2026-09-15T13:00:00Z"),
      pricing: null,
      bookingTotal: null,
      bookingPaid: null,
      vehicle: null,
    });
    expect(summary.statusLabel).toBe("Pendiente");
    expect(summary.vehicle).toBeNull();
    expect(summary.bookingNumber).toBeNull();
  });
});
