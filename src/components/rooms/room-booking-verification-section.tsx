"use client";

import { VerificationSection, type VerificationEvent } from "@/components/verification-section";
import { verifyRoomBooking, unverifyRoomBooking } from "@/app/(app)/rooms/verification-actions";

/**
 * Verificación de una reserva de habitación por un admin — mismo mecanismo
 * que `RentalVerificationSection`, wrapper fino sobre `VerificationSection`
 * atado a este `bookingId`. Solo se renderiza para estadías reales
 * confirmadas (ver `canVerifyRoomBooking`); si después cambia algo de plata,
 * el sistema la desverifica sola (`autoUnverifyRoomBooking`).
 */
export function RoomBookingVerificationSection({
  bookingId,
  verified,
  isAdmin,
  history,
}: {
  bookingId: string;
  verified: { byName: string | null; at: Date } | null;
  isAdmin: boolean;
  history: VerificationEvent[];
}) {
  return (
    <VerificationSection
      verified={verified}
      isAdmin={isAdmin}
      history={history}
      onVerify={() => verifyRoomBooking(bookingId)}
      onUnverify={() => unverifyRoomBooking(bookingId)}
    />
  );
}
