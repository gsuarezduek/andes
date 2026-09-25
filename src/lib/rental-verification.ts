import type { RentalStatus } from "@prisma/client";

/**
 * Una reserva se puede verificar (y, por lo tanto, mostrar como verificada)
 * solo si es Confirmada, Activa o Finalizada: una Pendiente todavía no está
 * firme, una Cancelada o "En service" no tienen plata que revisar.
 */
export function canVerifyRental(status: RentalStatus, bookingConfirmed: boolean): boolean {
  return status === "active" || status === "finished" || (status === "reserved" && bookingConfirmed);
}

/**
 * ¿Se muestra como verificada? Además de tener `verifiedAt`, tiene que seguir
 * siendo una reserva verificable: si una Confirmada verificada vuelve a
 * Pendiente (o se cancela), la marca vieja no debe aparecer.
 */
export function isRentalVerified(
  rental: { status: RentalStatus; bookingConfirmed: boolean; verifiedAt: Date | null },
): boolean {
  return rental.verifiedAt != null && canVerifyRental(rental.status, rental.bookingConfirmed);
}
