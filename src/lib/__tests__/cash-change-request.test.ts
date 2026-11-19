import { describe, expect, it } from "vitest";
import {
  isEmptyProposal,
  mergeProposedEdit,
  proposedMovementEdit,
  type MovementEditInput,
  type MovementEditSnapshot,
} from "@/lib/cash-change-request";

const current: MovementEditSnapshot = {
  description: "Cobro reserva",
  amount: 100,
  currency: "ars",
  paymentMethodId: "efectivo",
  paymentMethodNote: null,
  recipientPaymentMethodId: null,
  recipientPaymentMethodNote: null,
  categoryId: null,
};

const same: MovementEditInput = {
  description: "Cobro reserva",
  amount: 100,
  currency: "ars",
  paymentMethodId: "efectivo",
};

describe("proposedMovementEdit", () => {
  it("sin cambios devuelve una propuesta vacía", () => {
    expect(isEmptyProposal(proposedMovementEdit(current, same, "income"))).toBe(true);
  });

  it("solo guarda lo que cambió", () => {
    const p = proposedMovementEdit(current, { ...same, amount: 90 }, "income");
    expect(p).toEqual({ amount: 90 });
  });

  it("la cuenta viaja con su aclaración", () => {
    const p = proposedMovementEdit(current, { ...same, paymentMethodId: "otro", paymentMethodNote: "caja chica" }, "income");
    expect(p).toEqual({ account: { paymentMethodId: "otro", paymentMethodNote: "caja chica" } });
  });

  it("ignora destino y categoría en un ingreso", () => {
    const p = proposedMovementEdit(current, { ...same, categoryId: "nafta", recipientPaymentMethodId: "taller" }, "income");
    expect(isEmptyProposal(p)).toBe(true);
  });

  it("en un egreso registra destino y categoría", () => {
    const p = proposedMovementEdit(current, { ...same, categoryId: "nafta", recipientPaymentMethodId: "taller" }, "expense");
    expect(p).toEqual({
      recipient: { recipientPaymentMethodId: "taller", recipientPaymentMethodNote: null },
      category: { categoryId: "nafta" },
    });
  });

  it("aclaración vacía y nula son lo mismo", () => {
    const p = proposedMovementEdit(current, { ...same, paymentMethodNote: "" }, "income");
    expect(isEmptyProposal(p)).toBe(true);
  });
});

describe("mergeProposedEdit", () => {
  it("aplica lo propuesto sin pisar lo que un admin corrigió después", () => {
    const proposed = proposedMovementEdit(current, { ...same, amount: 90 }, "expense");
    // Mientras tanto un admin corrigió el detalle y la categoría.
    const now: MovementEditSnapshot = { ...current, description: "Nafta Kwid", categoryId: "nafta" };
    expect(mergeProposedEdit(now, proposed)).toEqual({
      description: "Nafta Kwid",
      amount: 90,
      currency: "ars",
      paymentMethodId: "efectivo",
      paymentMethodNote: undefined,
      recipientPaymentMethodId: undefined,
      recipientPaymentMethodNote: undefined,
      categoryId: "nafta",
    });
  });

  it("puede quitar una categoría", () => {
    const withCat: MovementEditSnapshot = { ...current, categoryId: "nafta" };
    const proposed = proposedMovementEdit(withCat, { ...same }, "expense");
    expect(proposed).toEqual({ category: { categoryId: null } });
    expect(mergeProposedEdit(withCat, proposed).categoryId).toBeUndefined();
  });
});
