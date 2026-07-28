import { describe, it, expect } from "vitest";
import { computeRentalPayments, paymentAccent } from "@/lib/rental-payments";

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

describe("paymentAccent", () => {
  it("activo con saldo en cero: completo", () => {
    expect(paymentAccent("active", true, { balance: 0 })).toBe("complete");
  });

  it("activo con saldo negativo (sobrepago): completo", () => {
    expect(paymentAccent("active", true, { balance: -500 })).toBe("complete");
  });

  it("activo con saldo positivo: falta pagar", () => {
    expect(paymentAccent("active", true, { balance: 15_000 })).toBe("pending");
  });

  it("reservado y confirmado, sin saldo pendiente: completo", () => {
    expect(paymentAccent("reserved", true, { balance: 0 })).toBe("complete");
  });

  it("reservado y confirmado, con saldo: falta pagar", () => {
    expect(paymentAccent("reserved", true, { balance: 10_000 })).toBe("pending");
  });

  it("reservado sin confirmar: no aplica, aunque haya saldo", () => {
    expect(paymentAccent("reserved", false, { balance: 10_000 })).toBeNull();
  });

  it("cancelado: no aplica", () => {
    expect(paymentAccent("cancelled", true, { balance: 10_000 })).toBeNull();
  });

  it("finalizado: no aplica (fuera de alcance a propósito)", () => {
    expect(paymentAccent("finished", true, { balance: 10_000 })).toBeNull();
  });

  it("sin datos de saldo: no aplica", () => {
    expect(paymentAccent("active", true, { balance: null })).toBeNull();
    expect(paymentAccent("reserved", true, { balance: null })).toBeNull();
  });
});
