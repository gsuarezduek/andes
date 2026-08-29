import { describe, it, expect, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    wpPaymentMethod: { findUnique: vi.fn() },
    rental: { findUnique: vi.fn(), update: vi.fn() },
    cashMovement: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { importBookingPayment } from "@/lib/sync/booking-upsert";

let tx: { cashMovement: { create: ReturnType<typeof vi.fn> }; rental: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> } };

beforeEach(() => {
  vi.clearAllMocks();
  tx = {
    cashMovement: { create: vi.fn().mockResolvedValue({ id: "cm1" }) },
    rental: {
      findUnique: vi.fn().mockResolvedValue({ pricing: null }),
      update: vi.fn().mockResolvedValue({}),
    },
  };
  prismaMock.$transaction.mockImplementation(async (cb: (t: typeof tx) => unknown) => cb(tx));
  prismaMock.wpPaymentMethod.findUnique.mockResolvedValue(null);
});

describe("importBookingPayment", () => {
  it("no hace nada si no hay diferencia respecto de lo ya importado", async () => {
    await importBookingPayment("r1", 20_000, 20_000, "Stripe", 2997, "Juan Pérez");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("no hace nada si bookingPaid es null", async () => {
    await importBookingPayment("r1", null, null, null, 2997, "Juan Pérez");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("importa el monto completo cuando no había nada importado antes", async () => {
    await importBookingPayment("r1", null, 20_000, null, 2997, "Juan Pérez");

    expect(tx.cashMovement.create).toHaveBeenCalledOnce();
    const data = tx.cashMovement.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      type: "income",
      amount: 20_000,
      rentalId: "r1",
      needsConfirmation: true,
      paymentMethodId: null,
      paymentMethodName: "Sin confirmar (VikRentCar)",
    });
    expect(data.description).toContain("2997");

    expect(tx.rental.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: expect.objectContaining({ bookingPaidImportedAmount: 20_000 }),
    });
    const pricing = tx.rental.update.mock.calls[0][0].data.pricing;
    expect(pricing.payments).toHaveLength(1);
    expect(pricing.payments[0]).toMatchObject({ amount: 20_000, adjustedAmount: 20_000, cashMovementId: "cm1", unconfirmed: true });
  });

  it("solo importa la diferencia si ya se había importado una parte", async () => {
    await importBookingPayment("r1", 20_000, 35_000, null, 2997, "Juan Pérez");

    const data = tx.cashMovement.create.mock.calls[0][0].data;
    expect(data.amount).toBe(15_000);
    expect(tx.rental.update.mock.calls[0][0].data.bookingPaidImportedAmount).toBe(35_000);
  });

  it("agrega la nueva línea a los pagos existentes sin pisarlos", async () => {
    tx.rental.findUnique.mockResolvedValue({
      pricing: { total: 50_000, payments: [{ methodId: "pmX", methodName: "Efectivo", amount: 10_000, adjustedAmount: 10_000 }] },
    });

    await importBookingPayment("r1", null, 5_000, null, 2997, "Juan Pérez");

    const pricing = tx.rental.update.mock.calls[0][0].data.pricing;
    expect(pricing.payments).toHaveLength(2);
    expect(pricing.paid).toBe(15_000);
  });

  it("cuando el nombre de VikRentCar mapea a un único medio de Andes, confirma solo (sin needsConfirmation)", async () => {
    prismaMock.wpPaymentMethod.findUnique.mockResolvedValue({
      name: "Stripe",
      paymentMethods: [{ id: "pm1", name: "Cuenta Stripe" }],
    });

    await importBookingPayment("r1", null, 20_000, "Stripe", 2997, "Juan Pérez");

    const data = tx.cashMovement.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ needsConfirmation: false, paymentMethodId: "pm1", paymentMethodName: "Cuenta Stripe" });
  });

  it("cuando el nombre de VikRentCar mapea a más de un medio de Andes, queda sin confirmar", async () => {
    prismaMock.wpPaymentMethod.findUnique.mockResolvedValue({
      name: "Stripe",
      paymentMethods: [{ id: "pm1", name: "Cuenta Stripe A" }, { id: "pm2", name: "Cuenta Stripe B" }],
    });

    await importBookingPayment("r1", null, 20_000, "Stripe", 2997, "Juan Pérez");

    const data = tx.cashMovement.create.mock.calls[0][0].data;
    expect(data.needsConfirmation).toBe(true);
    expect(data.paymentMethodName).toContain("Stripe");
  });

  it("si el medio resuelto tiene % de recargo, calcula la base hacia atrás — solo la base cuenta para Paga", async () => {
    prismaMock.wpPaymentMethod.findUnique.mockResolvedValue({
      name: "Tarjeta",
      paymentMethods: [{ id: "pm1", name: "Tarjeta (+6%)", adjustmentPercent: 6 }],
    });

    // El cliente debía $50 pero por el recargo de tarjeta terminó pagando $53
    // (lo que realmente llegó a la cuenta, `totpaid` de VikRentCar).
    await importBookingPayment("r1", null, 53_000, "Tarjeta", 2997, "Juan Pérez");

    // Caja/CashMovement.amount sigue siendo lo real cobrado — nunca se toca.
    const cashData = tx.cashMovement.create.mock.calls[0][0].data;
    expect(cashData.amount).toBe(53_000);

    const pricing = tx.rental.update.mock.calls[0][0].data.pricing;
    expect(pricing.payments[0]).toMatchObject({ amount: 50_000, adjustedAmount: 53_000, adjustmentPercent: 6 });
    // "Paga" cuenta la base, no lo cobrado con recargo.
    expect(pricing.paid).toBe(50_000);
  });

  it("sin % en el medio resuelto, base = adjustedAmount (sin split)", async () => {
    prismaMock.wpPaymentMethod.findUnique.mockResolvedValue({
      name: "Efectivo",
      paymentMethods: [{ id: "pm1", name: "Efectivo" }],
    });

    await importBookingPayment("r1", null, 20_000, "Efectivo", 2997, "Juan Pérez");

    const pricing = tx.rental.update.mock.calls[0][0].data.pricing;
    expect(pricing.payments[0]).toMatchObject({ amount: 20_000, adjustedAmount: 20_000 });
  });
});
