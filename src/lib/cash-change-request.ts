import type { Currency } from "@/lib/currency";

/**
 * Pedidos de cambio de un movimiento de Caja (ver `CashMovementChangeRequest`).
 * Lógica pura, sin Prisma: qué campos cambió el empleado y cómo se aplican
 * sobre los valores del momento en que un admin lo aprueba.
 */

/** Valores editables de un ingreso/egreso — lo que manda el formulario de edición. */
export type MovementEditInput = {
  description: string;
  amount: number;
  currency: Currency;
  paymentMethodId: string;
  paymentMethodNote?: string;
  recipientPaymentMethodId?: string;
  recipientPaymentMethodNote?: string;
  categoryId?: string;
};

/** Valores actuales del movimiento, en el mismo formato (vacío = undefined). */
export type MovementEditSnapshot = {
  description: string;
  amount: number;
  currency: Currency;
  paymentMethodId: string | null;
  paymentMethodNote: string | null;
  recipientPaymentMethodId: string | null;
  recipientPaymentMethodNote: string | null;
  categoryId: string | null;
};

/**
 * Solo lo que el empleado cambió. La cuenta viaja con su aclaración (y el
 * destino con la suya): una aclaración solo tiene sentido junto a su cuenta.
 */
export type ProposedMovementEdit = {
  description?: string;
  amount?: number;
  currency?: Currency;
  account?: { paymentMethodId: string; paymentMethodNote: string | null };
  recipient?: { recipientPaymentMethodId: string | null; recipientPaymentMethodNote: string | null };
  category?: { categoryId: string | null };
};

const blank = (v: string | null | undefined) => (v == null || v === "" ? null : v);

export function proposedMovementEdit(
  current: MovementEditSnapshot,
  input: MovementEditInput,
  type: "income" | "expense",
): ProposedMovementEdit {
  const out: ProposedMovementEdit = {};
  if (input.description !== current.description) out.description = input.description;
  if (input.amount !== current.amount) out.amount = input.amount;
  if (input.currency !== current.currency) out.currency = input.currency;
  if (
    input.paymentMethodId !== current.paymentMethodId ||
    blank(input.paymentMethodNote) !== blank(current.paymentMethodNote)
  ) {
    out.account = { paymentMethodId: input.paymentMethodId, paymentMethodNote: blank(input.paymentMethodNote) };
  }
  // Destino y categoría solo existen en un egreso.
  if (type === "expense") {
    if (
      blank(input.recipientPaymentMethodId) !== blank(current.recipientPaymentMethodId) ||
      blank(input.recipientPaymentMethodNote) !== blank(current.recipientPaymentMethodNote)
    ) {
      out.recipient = {
        recipientPaymentMethodId: blank(input.recipientPaymentMethodId),
        recipientPaymentMethodNote: blank(input.recipientPaymentMethodNote),
      };
    }
    if (blank(input.categoryId) !== blank(current.categoryId)) {
      out.category = { categoryId: blank(input.categoryId) };
    }
  }
  return out;
}

export function isEmptyProposal(p: ProposedMovementEdit): boolean {
  return Object.keys(p).length === 0;
}

/**
 * Aplica lo propuesto sobre los valores actuales: lo que el empleado no tocó
 * queda como está ahora (aunque un admin lo haya corregido después del pedido).
 */
export function mergeProposedEdit(current: MovementEditSnapshot, p: ProposedMovementEdit): MovementEditInput {
  const account = p.account ?? {
    paymentMethodId: current.paymentMethodId ?? "",
    paymentMethodNote: current.paymentMethodNote,
  };
  const recipient = p.recipient ?? {
    recipientPaymentMethodId: current.recipientPaymentMethodId,
    recipientPaymentMethodNote: current.recipientPaymentMethodNote,
  };
  const categoryId = p.category ? p.category.categoryId : current.categoryId;
  return {
    description: p.description ?? current.description,
    amount: p.amount ?? current.amount,
    currency: p.currency ?? current.currency,
    paymentMethodId: account.paymentMethodId,
    paymentMethodNote: blank(account.paymentMethodNote) ?? undefined,
    recipientPaymentMethodId: blank(recipient.recipientPaymentMethodId) ?? undefined,
    recipientPaymentMethodNote: blank(recipient.recipientPaymentMethodNote) ?? undefined,
    categoryId: blank(categoryId) ?? undefined,
  };
}
