import type { RoomBookingStatus } from "@prisma/client";

/**
 * Una reserva de habitación se puede verificar solo si es una estadía real
 * confirmada: una cancelada ya no tiene nada que revisar, y un bloqueo de
 * disponibilidad (`isBlock`) no es una reserva de un huésped — no hay plata
 * ni datos de cliente que verificar ahí. Mismo criterio que `canVerifyRental`.
 */
export function canVerifyRoomBooking(status: RoomBookingStatus, isBlock: boolean): boolean {
  return status === "confirmed" && !isBlock;
}

/**
 * ¿Se muestra como verificada? Además de tener `verifiedAt`, tiene que
 * seguir siendo verificable: si se cancela después de verificada, la marca
 * vieja no debe aparecer.
 */
export function isRoomBookingVerified(
  booking: { status: RoomBookingStatus; isBlock: boolean; verifiedAt: Date | null },
): boolean {
  return booking.verifiedAt != null && canVerifyRoomBooking(booking.status, booking.isBlock);
}
