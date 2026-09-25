"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { displayName } from "@/lib/user-display";
import { canVerifyRental } from "@/lib/rental-verification";

function revalidateRental(rentalId: string) {
  revalidatePath(`/rentals/${rentalId}`);
  revalidatePath("/rentals");
  revalidatePath("/calendar");
}

/** Marca la reserva como verificada (solo admin). Solo Confirmadas/Activas/Finalizadas. */
export async function verifyRental(rentalId: string): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  const rental = await prisma.rental.findUnique({
    where: { id: rentalId },
    select: { status: true, bookingConfirmed: true, verifiedAt: true },
  });
  if (!rental) return { error: "La reserva no existe." };
  if (!canVerifyRental(rental.status, rental.bookingConfirmed)) {
    return { error: "Solo se pueden verificar reservas confirmadas, activas o finalizadas." };
  }
  if (rental.verifiedAt) return {}; // ya verificada (doble click / otra pestaña)

  const name = displayName(admin);
  await prisma.$transaction(async (tx) => {
    // Guarda contra la carrera de dos admins verificando a la vez: solo el
    // primero cambia la fila y deja constancia.
    const { count } = await tx.rental.updateMany({
      where: { id: rentalId, verifiedAt: null },
      data: { verifiedAt: new Date(), verifiedById: admin.id, verifiedByName: name },
    });
    if (count > 0) {
      await tx.rentalVerification.create({
        data: { rentalId, action: "verified", byId: admin.id, byName: name },
      });
    }
  });

  revalidateRental(rentalId);
  return {};
}

/** Quita la verificación (solo admin); queda en el historial. */
export async function unverifyRental(rentalId: string): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  const name = displayName(admin);
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.rental.updateMany({
      where: { id: rentalId, verifiedAt: { not: null } },
      data: { verifiedAt: null, verifiedById: null, verifiedByName: null },
    });
    if (count > 0) {
      await tx.rentalVerification.create({
        data: { rentalId, action: "unverified", byId: admin.id, byName: name },
      });
    }
  });

  revalidateRental(rentalId);
  return {};
}
