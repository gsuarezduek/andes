"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { paymentSchema } from "@/lib/payment-schema";
import { paymentsToCashMovements } from "@/lib/cash";
import { computeBalance, roundMoney, type ContractPricing } from "@/lib/contract";

/**
 * Pago suelto cargado desde el detalle de la reserva (botón "Agregar pago"),
 * sin pasar por la entrega — típico caso: el cliente deja la seña antes de
 * retirar el auto. Se suma a `rental.pricing.payments` (misma lista que usan
 * la entrega y la devolución: si más tarde se hace la entrega, el asistente
 * ya lo ve reflejado en "Paga") y crea el cobro correspondiente en Caja,
 * vinculado a esta reserva.
 */
export async function addRentalPayment(rentalId: string, input: unknown) {
  const user = await requireUser();
  const payment = paymentSchema.parse(input);
  if (payment.amount <= 0) throw new Error("El importe tiene que ser mayor a cero.");

  const rental = await prisma.rental.findUnique({ where: { id: rentalId } });
  if (!rental) throw new Error("El alquiler no existe.");
  if (rental.status !== "reserved" && rental.status !== "active") {
    throw new Error("Solo se pueden cargar pagos en reservas pendientes de entrega o activas.");
  }

  const pricing = (rental.pricing ?? {}) as ContractPricing;
  const nextPayments = [...(pricing.payments ?? []), payment];
  const nextPaid = roundMoney(nextPayments.reduce((sum, p) => sum + p.adjustedAmount, 0));
  const nextPricing: ContractPricing = { ...pricing, payments: nextPayments, paid: nextPaid };
  if (pricing.total != null) {
    nextPricing.balance = computeBalance({ total: pricing.total, sena: pricing.sena, paid: nextPaid }) ?? undefined;
  }

  await prisma.$transaction([
    prisma.rental.update({ where: { id: rentalId }, data: { pricing: nextPricing } }),
    prisma.cashMovement.createMany({
      data: paymentsToCashMovements([payment], {
        rentalId,
        createdById: user.id,
        description: `Pago — ${rental.clientName}`,
      }),
    }),
  ]);

  revalidatePath(`/rentals/${rentalId}`);
  revalidatePath("/caja");
}
