"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";

/**
 * Elimina una reserva (solo admin). Pensado para reservas huérfanas: órdenes que
 * se **borraron** en VikRentCar (no canceladas) y quedaron acá como "reservado",
 * o cargas manuales erróneas. **Guarda de evidencia:** no se puede eliminar una
 * reserva que ya tiene una inspección (entrega/acta firmada es inmutable) — esas
 * se conservan siempre. Borra en cascada los documentos y pedidos de firma
 * (que solo existen si hubo un intento de entrega) dentro de una transacción.
 */
export async function deleteRental(id: string): Promise<void> {
  await requireAdmin();

  const rental = await prisma.rental.findUnique({
    where: { id },
    include: { inspections: { select: { id: true }, take: 1 } },
  });
  if (!rental) redirect("/rentals");
  if (rental.inspections.length > 0) {
    throw new Error(
      "No se puede eliminar: la reserva ya tiene una entrega/acta registrada (evidencia inmutable).",
    );
  }

  await prisma.$transaction([
    prisma.signatureRequest.deleteMany({ where: { rentalId: id } }),
    prisma.rentalDocument.deleteMany({ where: { rentalId: id } }),
    prisma.rental.delete({ where: { id } }),
  ]);

  revalidatePath("/rentals");
  redirect("/rentals");
}
