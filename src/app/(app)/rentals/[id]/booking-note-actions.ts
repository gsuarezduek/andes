"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { displayName } from "@/lib/user-display";

const schema = z.string().max(5000, "Máximo 5000 caracteres.");

/**
 * Edita la "Info de la reserva" (`bookingNote`, el custdata de VikRentCar o
 * lo que cargue el equipo en una reserva manual). Cualquier rol, cualquier
 * estado de la reserva. A partir de acá el sync deja de pisar el campo para
 * esta reserva (`bookingNoteEditedAt`, ver `booking-upsert.ts`).
 */
export async function updateBookingNote(rentalId: string, text: string): Promise<{ error?: string }> {
  const user = await requireUser();
  const parsed = schema.safeParse(text);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Texto inválido." };

  const rental = await prisma.rental.findUnique({ where: { id: rentalId }, select: { id: true } });
  if (!rental) return { error: "El alquiler no existe." };

  const next = parsed.data.trim();
  await prisma.rental.update({
    where: { id: rentalId },
    data: {
      bookingNote: next === "" ? null : next,
      bookingNoteEditedAt: new Date(),
      bookingNoteEditedByName: displayName(user),
    },
  });

  revalidatePath(`/rentals/${rentalId}`);
  revalidatePath("/calendar");
  return {};
}
