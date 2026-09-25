"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { displayName } from "@/lib/user-display";
import { roundMoney, type ContractPricing } from "@/lib/contract";
import { computeRentalPayments } from "@/lib/rental-payments";
import { autoUnverifyRental } from "@/lib/rental-verification-server";

const reasonSchema = z.string().trim().min(3, "Indicá el motivo.").max(300);

function revalidateRental(rentalId: string) {
  revalidatePath(`/rentals/${rentalId}`);
  revalidatePath("/rentals");
  revalidatePath("/calendar");
  revalidatePath("/caja");
  revalidatePath("/");
}

/**
 * "Aceptar la pérdida": un admin da por cerrado el saldo pendiente de una
 * reserva ya finalizada (ver `RentalWriteOff`). El saldo pasa a 0, deja de
 * figurar como urgente en Caja/Home y queda registrado quién, cuándo, cuánto
 * y por qué. No toca Caja: no entró ni salió plata. Se puede deshacer.
 */
export async function writeOffRentalBalance(rentalId: string, reasonInput: string): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  const parsed = reasonSchema.safeParse(reasonInput);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Indicá el motivo." };

  const rental = await prisma.rental.findUnique({
    where: { id: rentalId },
    select: { status: true, pricing: true, bookingTotal: true, bookingPaid: true },
  });
  if (!rental) return { error: "La reserva no existe." };
  if (rental.status !== "finished") return { error: "Solo se puede condonar el saldo de una reserva finalizada." };

  const payments = computeRentalPayments(rental);
  if (payments.balance == null || payments.balance <= 0) return { error: "Esta reserva no tiene saldo pendiente." };

  const pricing = (rental.pricing ?? {}) as ContractPricing;
  const nextPricing: ContractPricing = {
    ...pricing,
    writeOff: {
      amount: roundMoney((pricing.writeOff?.amount ?? 0) + payments.balance),
      reason: parsed.data,
      byName: displayName(admin),
      at: new Date().toISOString(),
    },
  };

  await prisma.$transaction(async (tx) => {
    await tx.rental.update({ where: { id: rentalId }, data: { pricing: nextPricing } });
    await autoUnverifyRental(tx, rentalId, "Se condonó el saldo pendiente.");
  });

  revalidateRental(rentalId);
  return {};
}

/** Deshace la condonación: el saldo vuelve a figurar como pendiente. */
export async function undoWriteOffRentalBalance(rentalId: string): Promise<{ error?: string }> {
  await requireAdmin();
  const rental = await prisma.rental.findUnique({ where: { id: rentalId }, select: { pricing: true } });
  if (!rental) return { error: "La reserva no existe." };

  const { writeOff, ...rest } = (rental.pricing ?? {}) as ContractPricing;
  if (!writeOff) return {};

  await prisma.$transaction(async (tx) => {
    await tx.rental.update({ where: { id: rentalId }, data: { pricing: rest } });
    await autoUnverifyRental(tx, rentalId, "Se deshizo la condonación del saldo.");
  });

  revalidateRental(rentalId);
  return {};
}
