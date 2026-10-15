import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { SYSTEM_VERIFIER_LABEL } from "@/lib/rental-verification-server";

type Db =
  | Pick<PrismaClient, "roomBooking" | "roomBookingVerification">
  | Pick<Prisma.TransactionClient, "roomBooking" | "roomBookingVerification">;

/**
 * Le quita la verificación a una reserva de habitación cuando cambia algo de
 * plata después de verificada (un cobro nuevo, un movimiento de Caja
 * editado/borrado, el total editado) — mismo criterio que
 * `autoUnverifyRental`. No hace nada si no estaba verificada. Pasar el
 * cliente de la transacción cuando se llama desde una.
 */
export async function autoUnverifyRoomBooking(db: Db, roomBookingId: string, reason: string): Promise<void> {
  const { count } = await db.roomBooking.updateMany({
    where: { id: roomBookingId, verifiedAt: { not: null } },
    data: { verifiedAt: null, verifiedById: null, verifiedByName: null },
  });
  if (count > 0) {
    await db.roomBookingVerification.create({
      data: { roomBookingId, action: "auto_unverified", reason, byName: SYSTEM_VERIFIER_LABEL },
    });
  }
}
