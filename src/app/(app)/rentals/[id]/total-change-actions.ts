"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { displayName } from "@/lib/user-display";
import { addToContractTotal, type ContractPricing } from "@/lib/contract";
import { autoUnverifyRental } from "@/lib/rental-verification-server";

const applySchema = z.object({
  amount: z
    .number()
    .refine((v) => Number.isFinite(v) && v !== 0, "El importe tiene que ser distinto de cero."),
});

const ALREADY_RESOLVED = "Este aviso ya se resolvió.";

function revalidateRental(rentalId: string) {
  revalidatePath(`/rentals/${rentalId}`);
  revalidatePath("/rentals");
  revalidatePath("/calendar");
}

/**
 * Suma al contrato (o resta, si `amount` es negativo) la diferencia de total
 * detectada por el sync — ver `RentalTotalChange`. El `updateMany` con
 * `status: "pending"` evita aplicarla dos veces (doble tap, dos empleados).
 */
export async function applyRentalTotalChange(changeId: string, input: unknown): Promise<{ error?: string }> {
  const user = await requireUser();
  const parsed = applySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const { amount } = parsed.data;

  const change = await prisma.rentalTotalChange.findUnique({ where: { id: changeId } });
  if (!change) return { error: "El aviso no existe." };

  const error = await prisma.$transaction(async (tx) => {
    const { count } = await tx.rentalTotalChange.updateMany({
      where: { id: changeId, status: "pending" },
      data: {
        status: "applied",
        appliedAmount: amount,
        resolvedAt: new Date(),
        resolvedByName: displayName(user),
      },
    });
    if (count === 0) return ALREADY_RESOLVED;

    const rental = await tx.rental.findUniqueOrThrow({ where: { id: change.rentalId }, select: { pricing: true } });
    await tx.rental.update({
      where: { id: change.rentalId },
      data: { pricing: addToContractTotal((rental.pricing ?? {}) as ContractPricing, amount) },
    });
    await autoUnverifyRental(tx, change.rentalId, "Se ajustó el total del contrato por un cambio en VikRentCar.");
    return null;
  });
  if (error) return { error };

  revalidateRental(change.rentalId);
  return {};
}

/** Deja el contrato como está: la diferencia no corresponde (ej. ya se cobró de otra forma). */
export async function dismissRentalTotalChange(changeId: string): Promise<{ error?: string }> {
  const user = await requireUser();

  const change = await prisma.rentalTotalChange.findUnique({ where: { id: changeId } });
  if (!change) return { error: "El aviso no existe." };

  const { count } = await prisma.rentalTotalChange.updateMany({
    where: { id: changeId, status: "pending" },
    data: { status: "dismissed", resolvedAt: new Date(), resolvedByName: displayName(user) },
  });
  if (count === 0) return { error: ALREADY_RESOLVED };

  revalidateRental(change.rentalId);
  return {};
}
