import { describe, it, expect } from "vitest";
import { computeRentalPayments } from "@/lib/rental-payments";

describe("computeRentalPayments", () => {
  it("antes de la entrega, sin nada cargado: no muestra nada", () => {
    const r = computeRentalPayments({ pricing: null, bookingTotal: null, bookingPaid: null });
    expect(r).toMatchObject({ hasContract: false, hasRealPaid: false, totalRef: null, paidSoFar: null, balance: null, showPayments: false });
  });

  it("antes de la entrega: usa el total/pagado de referencia de VikRentCar", () => {
    const r = computeRentalPayments({ pricing: null, bookingTotal: 100_000 as never, bookingPaid: 20_000 as never });
    expect(r.hasContract).toBe(false);
    expect(r.hasRealPaid).toBe(false);
    expect(r.totalRef).toBe(100_000);
    expect(r.paidSoFar).toBe(20_000);
    expect(r.balance).toBe(80_000);
  });

  it("pago rápido antes de la entrega: pisa bookingPaid pero no bookingTotal (no hay contrato todavía)", () => {
    const r = computeRentalPayments({
      pricing: { paid: 30_000, payments: [{ methodName: "Efectivo", amount: 30_000, adjustedAmount: 30_000 }] } as never,
      bookingTotal: 100_000 as never,
      bookingPaid: 20_000 as never,
    });
    expect(r.hasContract).toBe(false);
    expect(r.hasRealPaid).toBe(true);
    expect(r.totalRef).toBe(100_000);
    expect(r.paidSoFar).toBe(30_000);
    expect(r.balance).toBe(70_000);
  });

  it("después de la entrega (con total cargado): usa el contrato como fuente", () => {
    const r = computeRentalPayments({
      pricing: { total: 90_000, sena: 10_000, paid: 20_000 } as never,
      bookingTotal: 100_000 as never,
      bookingPaid: 20_000 as never,
    });
    expect(r.hasContract).toBe(true);
    expect(r.hasRealPaid).toBe(true);
    expect(r.totalRef).toBe(90_000);
    expect(r.paidSoFar).toBe(30_000);
    expect(r.balance).toBe(60_000);
  });
});
