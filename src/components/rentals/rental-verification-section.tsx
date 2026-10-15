"use client";

import { VerificationSection, type VerificationEvent } from "@/components/verification-section";
import { verifyRental, unverifyRental } from "@/app/(app)/rentals/[id]/verification-actions";

export type { VerificationEvent };

/**
 * Verificación de la reserva por un admin — wrapper fino sobre
 * `VerificationSection` (compartido con `RoomBookingVerificationSection`) que
 * ata las acciones a este `rentalId`. Solo se renderiza para reservas
 * verificables (ver `canVerifyRental`); si después cambia algo de plata, el
 * sistema la desverifica sola (`autoUnverifyRental`).
 */
export function RentalVerificationSection({
  rentalId,
  verified,
  isAdmin,
  history,
}: {
  rentalId: string;
  verified: { byName: string | null; at: Date } | null;
  isAdmin: boolean;
  history: VerificationEvent[];
}) {
  return (
    <VerificationSection
      verified={verified}
      isAdmin={isAdmin}
      history={history}
      onVerify={() => verifyRental(rentalId)}
      onUnverify={() => unverifyRental(rentalId)}
    />
  );
}
