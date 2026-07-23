"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { mendozaWallTimeToUtc } from "@/lib/datetime";
import { returnSchema, type FormState } from "./schemas";

/**
 * Modifica la fecha y el lugar de devolución de un alquiler — típico cuando el
 * cliente extiende el alquiler. Solo se permite en **reservas manuales**: las de
 * VikRentCar se gestionan desde la web (fuente de verdad de las fechas) y se
 * sincronizan solas; editarlas acá dejaría la disponibilidad de VikRentCar
 * inconsistente. Se permite mientras el alquiler no esté finalizado ni cancelado
 * (reservado o activo). La devolución debe ser posterior al retiro.
 */
export async function updateReturnDetails(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();

  const parsed = returnSchema.safeParse({
    rentalId: formData.get("rentalId"),
    endAt: formData.get("endAt"),
    returnPlace: formData.get("returnPlace"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const rental = await prisma.rental.findUnique({
    where: { id: parsed.data.rentalId },
    select: { id: true, startAt: true, status: true, origin: true },
  });
  if (!rental) return { error: "El alquiler no existe." };
  if (rental.origin === "vikrentcar") {
    return {
      error:
        "Las fechas de una reserva de VikRentCar se cambian desde la web; se sincronizan solas.",
    };
  }
  if (rental.status === "finished" || rental.status === "cancelled") {
    return { error: "No se puede modificar un alquiler finalizado o cancelado." };
  }

  const endAt = mendozaWallTimeToUtc(parsed.data.endAt);
  if (endAt <= rental.startAt) {
    return { error: "La devolución debe ser posterior al retiro." };
  }

  await prisma.rental.update({
    where: { id: rental.id },
    data: { endAt, bookingReturnPlace: parsed.data.returnPlace ?? null },
  });

  revalidatePath(`/rentals/${rental.id}`);
  revalidatePath("/rentals");
  return { ok: true };
}
