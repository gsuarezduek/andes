"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { displayName } from "@/lib/user-display";
import { roundMoney } from "@/lib/contract";

/**
 * Resolver una garantía (Devolver/Cobrar, ver GuaranteeCard): admin-only,
 * mismo criterio que el resto de Caja. Las dos acciones comparten la misma
 * validación de la fila origen — tiene que ser la toma de una garantía
 * (`type: income, isGuarantee: true`) todavía activa (`guaranteeResolvedAt`
 * null); si no, la garantía ya se resolvió o el id no es de una garantía.
 */
async function loadActiveGuarantee(id: string) {
  const g = await prisma.cashMovement.findUnique({ where: { id } });
  if (!g || g.deletedAt) throw new Error("La garantía no existe.");
  if (g.type !== "income" || !g.isGuarantee) throw new Error("Este movimiento no es una garantía.");
  if (g.guaranteeResolvedAt) throw new Error("Esta garantía ya se resolvió.");
  return g;
}

const returnSchema = z.object({
  paymentMethodId: z.string().min(1),
  note: z.string().trim().max(300).optional(),
});

/** Devuelve la garantía completa al cliente — nunca parcial (para un cobro parcial, ver `chargeGuarantee`). */
export async function returnGuarantee(id: string, formData: FormData) {
  const user = await requireAdmin();
  const { paymentMethodId, note } = returnSchema.parse({
    paymentMethodId: formData.get("paymentMethodId"),
    note: formData.get("note") || undefined,
  });

  const guarantee = await loadActiveGuarantee(id);
  const method = await prisma.paymentMethod.findUnique({ where: { id: paymentMethodId } });
  if (!method) throw new Error("Cuenta inválida.");

  await prisma.$transaction([
    prisma.cashMovement.create({
      data: {
        type: "expense",
        description: `Devolución de garantía — ${guarantee.description}`,
        amount: guarantee.amount,
        currency: guarantee.currency,
        paymentMethodId: method.id,
        paymentMethodName: method.name,
        paymentMethodNote: note ?? null,
        rentalId: guarantee.rentalId,
        isGuarantee: true,
        guaranteeSourceId: guarantee.id,
        createdById: user.id,
        createdByName: displayName(user),
      },
    }),
    prisma.cashMovement.update({
      where: { id: guarantee.id },
      data: {
        guaranteeResolvedAt: new Date(),
        guaranteeReturnedAmount: guarantee.amount,
        guaranteeChargedAmount: 0,
        guaranteeResolvedById: user.id,
        guaranteeResolvedByName: displayName(user),
      },
    }),
  ]);

  revalidatePath("/caja");
}

const chargeSchema = z.object({
  amount: z.coerce.number().positive(),
  returnPaymentMethodId: z.string().optional(),
});

/**
 * Cobra la garantía — total o parcial. Lo cobrado pasa a ser un ingreso real
 * (cuenta para Movimientos/Saldos/reportes, a diferencia de la garantía en
 * sí); si queda un resto sin cobrar, se devuelve en el mismo momento — una
 * garantía nunca queda "parcialmente activa", esta acción siempre la resuelve
 * por completo.
 */
export async function chargeGuarantee(id: string, formData: FormData) {
  const user = await requireAdmin();
  const { amount, returnPaymentMethodId } = chargeSchema.parse({
    amount: formData.get("amount"),
    returnPaymentMethodId: formData.get("returnPaymentMethodId") || undefined,
  });

  const guarantee = await loadActiveGuarantee(id);
  const total = Number(guarantee.amount);
  if (amount > total) throw new Error("No podés cobrar más de lo que se tomó de garantía.");
  const remainder = roundMoney(total - amount);

  let returnMethod: { id: string; name: string } | null = null;
  if (remainder > 0) {
    if (!returnPaymentMethodId) throw new Error("Falta la cuenta de la que sale la devolución del resto.");
    const found = await prisma.paymentMethod.findUnique({ where: { id: returnPaymentMethodId } });
    if (!found) throw new Error("Cuenta inválida.");
    returnMethod = found;
  }

  await prisma.$transaction([
    prisma.cashMovement.create({
      data: {
        type: "income",
        description: `Garantía cobrada — ${guarantee.description}`,
        amount,
        currency: guarantee.currency,
        paymentMethodId: guarantee.paymentMethodId,
        paymentMethodName: guarantee.paymentMethodName,
        rentalId: guarantee.rentalId,
        isGuarantee: false,
        guaranteeSourceId: guarantee.id,
        createdById: user.id,
        createdByName: displayName(user),
      },
    }),
    ...(returnMethod
      ? [
          prisma.cashMovement.create({
            data: {
              type: "expense",
              description: `Devolución de garantía (resto) — ${guarantee.description}`,
              amount: remainder,
              currency: guarantee.currency,
              paymentMethodId: returnMethod.id,
              paymentMethodName: returnMethod.name,
              rentalId: guarantee.rentalId,
              isGuarantee: true,
              guaranteeSourceId: guarantee.id,
              createdById: user.id,
              createdByName: displayName(user),
            },
          }),
        ]
      : []),
    prisma.cashMovement.update({
      where: { id: guarantee.id },
      data: {
        guaranteeResolvedAt: new Date(),
        guaranteeChargedAmount: amount,
        guaranteeReturnedAmount: remainder,
        guaranteeResolvedById: user.id,
        guaranteeResolvedByName: displayName(user),
      },
    }),
  ]);

  revalidatePath("/caja");
}
