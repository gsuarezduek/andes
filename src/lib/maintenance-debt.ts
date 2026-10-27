import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * El costo de un mantenimiento (service/arreglo/gasto) nunca es un pago en el
 * momento: el taller/proveedor lo acumula como **deuda** en su cuenta
 * corriente de Caja, y el pago real se anota después ("+ Pago" en la cuenta
 * del proveedor), compensando esa deuda. Por eso la cuenta tiene que ser de
 * un proveedor o asociado — nunca una cuenta propia (eso sería un egreso de
 * caja que no ocurrió).
 *
 * Valida la cuenta elegida y devuelve los datos del `CashMovement` de deuda
 * para crearlo dentro de la transacción del caller.
 */
export async function buildMaintenanceDebt({
  accountId,
  accountNote,
  amount,
  description,
  user,
}: {
  accountId: string | undefined;
  accountNote: string | undefined;
  amount: number;
  description: string;
  user: { id: string; name: string };
}): Promise<Prisma.CashMovementUncheckedCreateInput> {
  if (!accountId) throw new Error("Indicá a qué proveedor se le debe este gasto.");
  const account = await prisma.paymentMethod.findUnique({
    where: { id: accountId },
    select: { id: true, name: true, ownership: true, requiresNote: true },
  });
  if (!account || (account.ownership !== "provider" && account.ownership !== "associate")) {
    throw new Error("La cuenta elegida no es un proveedor/asociado.");
  }
  if (account.requiresNote && !accountNote) {
    throw new Error("Esta cuenta requiere indicar a dónde fue.");
  }
  return {
    type: "debt",
    description,
    amount,
    paymentMethodName: "",
    recipientPaymentMethodId: account.id,
    recipientPaymentMethodName: account.name,
    recipientPaymentMethodNote: account.requiresNote ? (accountNote ?? null) : null,
    createdById: user.id,
    createdByName: user.name,
  };
}
