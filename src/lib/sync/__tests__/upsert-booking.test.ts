import { describe, it, expect, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    rental: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    vehicle: { findFirst: vi.fn() },
    wpPaymentMethod: { findUnique: vi.fn(), upsert: vi.fn() },
    cashMovement: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/commissions-sync", () => ({ syncCommission: vi.fn(), deleteCommissionOf: vi.fn() }));

const { autoUnverifyRentalMock } = vi.hoisted(() => ({ autoUnverifyRentalMock: vi.fn() }));
vi.mock("@/lib/rental-verification-server", () => ({ autoUnverifyRental: autoUnverifyRentalMock }));

import { upsertBooking } from "@/lib/sync/booking-upsert";
import type { RawBooking } from "@/lib/sync/types";
import { vikRentCarUnixToUtc } from "@/lib/datetime";

let tx: {
  cashMovement: { create: ReturnType<typeof vi.fn> };
  rental: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  rentalExtension: { create: ReturnType<typeof vi.fn> };
};

function baseBooking(overrides: Partial<RawBooking> = {}): RawBooking {
  return {
    wpBookingId: 2997,
    status: "confirmed",
    idcar: null,
    carindex: null,
    startUnix: 1_700_000_000,
    endUnix: 1_700_100_000, // misma fecha de devolución que la reserva existente por default
    createdUnix: null,
    days: 3,
    lang: null,
    clientName: "Juan Pérez",
    clientEmail: null,
    clientPhone: null,
    clientDocNumber: null,
    clientCountry: null,
    custData: null,
    orderTotal: 100_000,
    paid: 20_000,
    carCost: null,
    carName: null,
    pickupPlace: null,
    returnPlace: null,
    optionals: null,
    paymentMethod: null,
    ...overrides,
  };
}

function existingRental(overrides: Record<string, unknown> = {}) {
  return {
    id: "r1",
    status: "active",
    endAt: vikRentCarUnixToUtc(1_700_100_000),
    datesEditedAt: null,
    clientEditedAt: null,
    bookingTotal: { toString: () => "100000" },
    bookingPaid: { toString: () => "20000" },
    bookingPaidImportedAmount: { toString: () => "20000" },
    inspections: [{ id: "insp1" }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  tx = {
    cashMovement: { create: vi.fn().mockResolvedValue({ id: "cm1" }) },
    rental: {
      findUnique: vi.fn().mockResolvedValue({ pricing: null }),
      update: vi.fn().mockResolvedValue({}),
    },
    rentalExtension: { create: vi.fn() },
  };
  prismaMock.$transaction.mockImplementation(async (cb: (t: typeof tx) => unknown) => cb(tx));
  prismaMock.wpPaymentMethod.findUnique.mockResolvedValue(null);
  prismaMock.wpPaymentMethod.upsert.mockResolvedValue({});
  prismaMock.vehicle.findFirst.mockResolvedValue(null);
  prismaMock.rental.update.mockResolvedValue({});
});

describe("upsertBooking — reserva ya en flujo físico (active/finished o con inspección)", () => {
  it("trae un pago nuevo cargado en VikRentCar aunque el alquiler ya esté activo (regresión: antes solo se traía 1 vez)", async () => {
    prismaMock.rental.findUnique.mockResolvedValue(existingRental());

    const outcome = await upsertBooking(baseBooking({ paid: 35_000 }));

    expect(outcome).toBe("updated");
    // Actualiza el dato de referencia bookingPaid.
    expect(prismaMock.rental.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: { bookingTotal: 100_000, bookingPaid: 35_000 },
    });
    // E importa la diferencia ($15.000) a Caja, tal como la primera vez.
    expect(tx.cashMovement.create).toHaveBeenCalledOnce();
    expect(tx.cashMovement.create.mock.calls[0][0].data.amount).toBe(15_000);
  });

  it("trae un SEGUNDO pago nuevo en una corrida posterior sobre la misma reserva activa (el bug reportado)", async () => {
    // 1ª corrida: ya había 20.000 importados.
    prismaMock.rental.findUnique.mockResolvedValue(existingRental());
    const first = await upsertBooking(baseBooking({ paid: 35_000 }));
    expect(first).toBe("updated");
    expect(tx.cashMovement.create.mock.calls[0][0].data.amount).toBe(15_000);

    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (cb: (t: typeof tx) => unknown) => cb(tx));
    tx.cashMovement.create.mockResolvedValue({ id: "cm2" });

    // 2ª corrida: el dueño cargó otro pago más en la web (ahora 50.000 en total).
    prismaMock.rental.findUnique.mockResolvedValue(
      existingRental({ bookingPaid: { toString: () => "35000" }, bookingPaidImportedAmount: { toString: () => "35000" } }),
    );
    const second = await upsertBooking(baseBooking({ paid: 50_000 }));

    expect(second).toBe("updated");
    expect(tx.cashMovement.create).toHaveBeenCalledOnce();
    expect(tx.cashMovement.create.mock.calls[0][0].data.amount).toBe(15_000);
  });

  it("no toca nada y devuelve skipped si no cambió ni el pago ni el total ni la fecha", async () => {
    prismaMock.rental.findUnique.mockResolvedValue(existingRental());

    const outcome = await upsertBooking(baseBooking({ paid: 20_000, orderTotal: 100_000 }));

    expect(outcome).toBe("skipped");
    expect(prismaMock.rental.update).not.toHaveBeenCalled();
    expect(tx.cashMovement.create).not.toHaveBeenCalled();
  });

  it("no toca fechas/vehículo de una reserva finalizada, pero sigue trayendo el pago", async () => {
    prismaMock.rental.findUnique.mockResolvedValue(existingRental({ status: "finished", inspections: [{ id: "insp1" }] }));

    const outcome = await upsertBooking(baseBooking({ paid: 40_000, endUnix: 1_900_000_000 }));

    expect(outcome).toBe("updated");
    // La fecha de devolución NO se actualiza fuera del caso de extensión de un
    // alquiler `active` — solo se actualiza bookingPaid/bookingTotal.
    expect(prismaMock.rental.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: { bookingTotal: 100_000, bookingPaid: 40_000 },
    });
  });
});
