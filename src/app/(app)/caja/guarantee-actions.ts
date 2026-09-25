"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { displayName } from "@/lib/user-display";
import { roundMoney } from "@/lib/contract";
import { autoUnverifyRental } from "@/lib/rental-verification-server";

/**
 * Resolver una garantía (Devolver/Cobrar, ver GuaranteeCard): cualquier rol
 * puede hacerlo (el registro de quién la resolvió queda en
 * `guaranteeResolvedByName`); eliminar una garantía cargada por error sigue
 * siendo solo admin (`deleteCashMovement`). Las dos acciones comparten la misma
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

/**
 * Resolución compartida por `returnGuarantee` y `chargeGuarantee`: una
 * garantía siempre termina en, como mucho, dos movimientos derivados — un
 * egreso por lo devuelto (`returnedAmount`, de `returnMethod`) y un ingreso
 * por lo que la empresa se queda (`keptAmount`, siempre de la MISMA cuenta
 * donde se tomó la garantía — no de `returnMethod`, que solo es el origen de
 * la devolución). Cualquiera de los dos puede ser 0 (no se crea ese
 * movimiento). Marca la garantía resuelta.
 */
async function applyGuaranteeResolution(
  guarantee: Awaited<ReturnType<typeof loadActiveGuarantee>>,
  user: Awaited<ReturnType<typeof requireUser>>,
  {
    returnedAmount,
    returnMethod,
    returnNote,
    keptAmount,
    keptDescription,
  }: {
    returnedAmount: number;
    returnMethod: { id: string; name: string } | null;
    returnNote: string | null;
    keptAmount: number;
    /** Descripción del ingreso por lo que la empresa se queda — distinta según venga de "Devolver" (diferencia) o "Cobrar" (cobro explícito). */
    keptDescription: string;
  },
) {
  await prisma.$transaction([
    ...(returnedAmount > 0 && returnMethod
      ? [
          prisma.cashMovement.create({
            data: {
              type: "expense",
              description: `Devolución de garantía${keptAmount > 0 ? " (parcial)" : ""} — ${guarantee.description}`,
              amount: returnedAmount,
              currency: guarantee.currency,
              paymentMethodId: returnMethod.id,
              paymentMethodName: returnMethod.name,
              paymentMethodNote: returnNote,
              rentalId: guarantee.rentalId,
              isGuarantee: true,
              guaranteeSourceId: guarantee.id,
              createdById: user.id,
              createdByName: displayName(user),
            },
          }),
        ]
      : []),
    ...(keptAmount > 0
      ? [
          prisma.cashMovement.create({
            data: {
              type: "income",
              description: keptDescription,
              amount: keptAmount,
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
        ]
      : []),
    prisma.cashMovement.update({
      where: { id: guarantee.id },
      data: {
        guaranteeResolvedAt: new Date(),
        guaranteeReturnedAmount: returnedAmount,
        guaranteeChargedAmount: keptAmount,
        guaranteeResolvedById: user.id,
        guaranteeResolvedByName: displayName(user),
      },
    }),
  ]);
  if (guarantee.rentalId) {
    await autoUnverifyRental(prisma, guarantee.rentalId, "Se resolvió la garantía de la reserva.");
  }
}

const returnSchema = z.object({
  amount: z.coerce.number().positive(),
  paymentMethodId: z.string().min(1),
  note: z.string().trim().max(300).optional(),
});

/**
 * Devuelve la garantía — total o parcial. A veces se devuelve menos de lo
 * tomado (ej. un daño chico que no justifica todo el trámite de "Cobrar"); la
 * diferencia no devuelta queda como un ingreso real, de la misma cuenta donde
 * se tomó la garantía — mismo criterio que lo cobrado en `chargeGuarantee`
 * (de hecho comparten la resolución, ver `applyGuaranteeResolution`). Nunca
 * queda "parcialmente activa": esta acción siempre la resuelve por completo.
 */
export async function returnGuarantee(id: string, formData: FormData) {
  const user = await requireUser();
  const { amount, paymentMethodId, note } = returnSchema.parse({
    amount: formData.get("amount"),
    paymentMethodId: formData.get("paymentMethodId"),
    note: formData.get("note") || undefined,
  });

  const guarantee = await loadActiveGuarantee(id);
  const total = Number(guarantee.amount);
  if (amount > total) throw new Error("No podés devolver más de lo que se tomó de garantía.");
  const kept = roundMoney(total - amount);

  const method = await prisma.paymentMethod.findUnique({ where: { id: paymentMethodId } });
  if (!method) throw new Error("Cuenta inválida.");

  await applyGuaranteeResolution(guarantee, user, {
    returnedAmount: amount,
    returnMethod: method,
    returnNote: note ?? null,
    keptAmount: kept,
    keptDescription: `Diferencia no devuelta de garantía — ${guarantee.description}`,
  });

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
  const user = await requireUser();
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

  await applyGuaranteeResolution(guarantee, user, {
    returnedAmount: remainder,
    returnMethod,
    returnNote: null,
    keptAmount: amount,
    keptDescription: `Garantía cobrada — ${guarantee.description}`,
  });

  revalidatePath("/caja");
}
