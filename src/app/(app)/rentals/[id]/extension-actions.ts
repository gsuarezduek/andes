"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { displayName } from "@/lib/user-display";
import { mendozaWallTimeToUtc } from "@/lib/datetime";
import { computeBalance, roundMoney, type ContractPricing } from "@/lib/contract";
import { autoUnverifyRental } from "@/lib/rental-verification-server";
import { extensionExtraDays } from "@/lib/rental-extension";

const extendSchema = z.object({
  newEndAt: z.string().min(1, "La fecha de devolución es obligatoria"),
  amount: z.number().min(0, "El importe no puede ser negativo"),
  note: z.string().optional(),
});

/** Suma `amount` a `pricing.total` y recalcula el saldo. Compartido por las dos acciones de acá. */
function applyExtensionCharge(pricing: ContractPricing, amount: number): ContractPricing {
  const nextTotal = roundMoney((pricing.total ?? 0) + amount);
  return {
    ...pricing,
    total: nextTotal,
    balance: computeBalance({ total: nextTotal, sena: pricing.sena, paid: pricing.paid }) ?? undefined,
  };
}

/**
 * Registra la extensión de un alquiler ya entregado: el cliente pide más días
 * (típico al momento de devolver). A diferencia de "Editar devolución"
 * (`updateReturnDetails`, sin cargo, solo reservas manuales antes de la
 * entrega), esto suma el cargo al contrato de una — el saldo/semáforo de pago
 * lo reflejan de inmediato, sin depender de una nota que se puede olvidar.
 * Disponible para cualquier origen: si la reserva viene de VikRentCar, a
 * partir de acá el sync deja de pisar la fecha de devolución (`datesEditedAt`,
 * mismo patrón que `clientEditedAt`).
 */
export async function extendRental(rentalId: string, input: unknown): Promise<{ error?: string }> {
  const user = await requireUser();
  const parsed = extendSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const { amount, note } = parsed.data;

  const rental = await prisma.rental.findUnique({ where: { id: rentalId } });
  if (!rental) return { error: "El alquiler no existe." };
  if (rental.status !== "active") {
    return { error: "Solo se puede extender un alquiler activo (ya entregado)." };
  }

  const newEndAt = mendozaWallTimeToUtc(parsed.data.newEndAt);
  if (newEndAt <= rental.endAt) {
    return { error: "La nueva fecha de devolución tiene que ser posterior a la actual." };
  }

  const extraDays = extensionExtraDays(rental.endAt, newEndAt);
  const name = displayName(user);
  const nextPricing = applyExtensionCharge((rental.pricing ?? {}) as ContractPricing, amount);

  await prisma.$transaction(async (tx) => {
    await tx.rental.update({
      where: { id: rentalId },
      data: { endAt: newEndAt, datesEditedAt: new Date(), pricing: nextPricing },
    });
    await tx.rentalExtension.create({
      data: {
        rentalId,
        previousEndAt: rental.endAt,
        newEndAt,
        extraDays,
        amount,
        note: note?.trim() || null,
        createdById: user.id,
        createdByName: name,
      },
    });
    await autoUnverifyRental(tx, rentalId, "Se extendió el alquiler.");
  });

  revalidatePath(`/rentals/${rentalId}`);
  revalidatePath("/rentals");
  revalidatePath("/calendar");
  return {};
}

const completeChargeSchema = z.object({
  amount: z.number().positive("El importe tiene que ser mayor a cero."),
  note: z.string().optional(),
});

/**
 * Completa el cobro de una extensión que el sync detectó sola (el cliente ya
 * extendió en VikRentCar, y trajimos la fecha nueva pero sin cargo — ver
 * `booking-upsert.ts`). A diferencia de `extendRental`, acá la fecha ya está
 * puesta: solo falta decir cuánto se cobra.
 */
export async function completeExtensionCharge(extensionId: string, input: unknown): Promise<{ error?: string }> {
  const user = await requireUser();
  const parsed = completeChargeSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const { amount, note } = parsed.data;

  const extension = await prisma.rentalExtension.findUnique({
    where: { id: extensionId },
    include: { rental: true },
  });
  if (!extension) return { error: "La extensión no existe." };
  if (extension.amount != null) return { error: "Esta extensión ya tiene un cobro cargado." };

  const nextPricing = applyExtensionCharge((extension.rental.pricing ?? {}) as ContractPricing, amount);

  await prisma.$transaction(async (tx) => {
    await tx.rental.update({ where: { id: extension.rentalId }, data: { pricing: nextPricing } });
    await tx.rentalExtension.update({
      where: { id: extensionId },
      data: { amount, note: note?.trim() || null, createdById: user.id, createdByName: displayName(user) },
    });
    await autoUnverifyRental(tx, extension.rentalId, "Se cargó el cobro de una extensión.");
  });

  revalidatePath(`/rentals/${extension.rentalId}`);
  revalidatePath("/rentals");
  revalidatePath("/calendar");
  return {};
}
