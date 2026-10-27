"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { displayName } from "@/lib/user-display";

const schema = z.object({
  description: z.string().trim().min(1, "Escribí el detalle.").max(500),
  amount: z.coerce.number().positive("El monto tiene que ser mayor a cero."),
  currency: z.enum(["ars", "usd"]).default("ars"),
  // Cuenta corriente a la que se le paga (ej. la dueña del auto).
  payeeAccountId: z.string().min(1),
  // Cuenta corriente con la que se contrae la deuda para hacerlo (ej. el taller).
  creditorAccountId: z.string().min(1, "Elegí a quién se le carga la deuda."),
});

/**
 * Compensación entre cuentas corrientes: le pagamos a una cuenta (ej. la
 * dueña de un auto, por el arreglo de su auto) cargándole la deuda a otra
 * (ej. el taller que lo hizo). No sale plata de ninguna cuenta propia, así que
 * no puede ser un "Pago" común (que siempre es un egreso de caja). Se crean
 * dos filas en la misma transacción: una `debt` en la cuenta del acreedor y
 * una `offset` en la del que cobra, apuntando a esa deuda. Ninguna de las dos
 * entra en Movimientos, Saldos ni Reportes (solo leen income/expense). Las dos
 * cuentas tienen que ser proveedores o asociados, de entidades distintas.
 * Cualquier rol puede cargarla, igual que una deuda o un pago.
 */
export async function createOffsetMovement(formData: FormData): Promise<{ error?: string }> {
  const user = await requireUser();
  const parsed = schema.safeParse({
    description: formData.get("description"),
    amount: formData.get("amount"),
    currency: formData.get("currency") || undefined,
    payeeAccountId: formData.get("payeeAccountId"),
    creditorAccountId: formData.get("creditorAccountId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const { description, amount, currency, payeeAccountId, creditorAccountId } = parsed.data;

  const accounts = await prisma.paymentMethod.findMany({
    where: { id: { in: [payeeAccountId, creditorAccountId] } },
    select: { id: true, name: true, ownership: true, parentId: true },
  });
  const payee = accounts.find((a) => a.id === payeeAccountId);
  const creditor = accounts.find((a) => a.id === creditorAccountId);
  const isThirdParty = (a?: { ownership: string }) => a?.ownership === "provider" || a?.ownership === "associate";
  if (!payee || !creditor || !isThirdParty(payee) || !isThirdParty(creditor)) {
    return { error: "Las dos cuentas tienen que ser proveedores o asociados." };
  }
  if ((payee.parentId ?? payee.id) === (creditor.parentId ?? creditor.id)) {
    return { error: "La deuda tiene que cargarse a otra cuenta, no a la misma." };
  }

  const createdByName = displayName(user);
  await prisma.$transaction(async (tx) => {
    const debt = await tx.cashMovement.create({
      data: {
        type: "debt",
        description,
        amount,
        currency,
        paymentMethodName: "",
        recipientPaymentMethodId: creditor.id,
        recipientPaymentMethodName: creditor.name,
        createdById: user.id,
        createdByName,
      },
    });
    await tx.cashMovement.create({
      data: {
        type: "offset",
        description,
        amount,
        currency,
        // Sin Origen real: se muestra contra qué deuda se compensó.
        paymentMethodName: creditor.name,
        recipientPaymentMethodId: payee.id,
        recipientPaymentMethodName: payee.name,
        offsetDebtId: debt.id,
        createdById: user.id,
        createdByName,
      },
    });
  });

  revalidatePath("/caja", "layout");
  return {};
}
