import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";

type Db = Pick<PrismaClient, "rental" | "rentalVerification"> | Pick<Prisma.TransactionClient, "rental" | "rentalVerification">;

export const SYSTEM_VERIFIER_LABEL = "Sistema";

/**
 * Le quita la verificación a una reserva cuando cambia algo de plata después
 * de verificada (un pago nuevo, un movimiento de Caja editado/borrado, el
 * contrato de la entrega/devolución, un cambio del total en VikRentCar): la
 * verificación ya no describiría lo que hay. No hace nada si la reserva no
 * estaba verificada. Dejar constancia en el historial (`auto_unverified`, con
 * el motivo). Pasar el cliente de la transacción cuando se llama desde una.
 */
export async function autoUnverifyRental(db: Db, rentalId: string, reason: string): Promise<void> {
  const { count } = await db.rental.updateMany({
    where: { id: rentalId, verifiedAt: { not: null } },
    data: { verifiedAt: null, verifiedById: null, verifiedByName: null },
  });
  if (count > 0) {
    await db.rentalVerification.create({
      data: { rentalId, action: "auto_unverified", reason, byName: SYSTEM_VERIFIER_LABEL },
    });
  }
}
