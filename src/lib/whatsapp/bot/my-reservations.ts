/**
 * Reservas del cliente para el bot de WhatsApp. El teléfono SIEMPRE lo fija
 * el código que llama (nunca un parámetro que controle el modelo) — así el
 * bot no puede terminar mostrando la reserva de otra persona ni aunque el
 * cliente le pase el número de reserva de un tercero.
 */
import "server-only";
import type { Rental, RentalStatus, Vehicle } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { phoneVariants } from "@/lib/whatsapp/phone";
import { rentalStatusDisplay } from "@/lib/rental-ui";
import { vehicleDisplayName } from "@/lib/vehicle-ui";
import { computeRentalPayments } from "@/lib/rental-payments";
import { formatDate } from "@/lib/datetime";

const MAX_RESERVATIONS = 5;
/** Reservas relevantes para el cliente: en curso/por venir, o recién finalizadas. */
const RELEVANT_STATUSES: RentalStatus[] = ["reserved", "active", "finished"];

export type ReservationSummary = {
  bookingNumber: number | null;
  statusLabel: string;
  vehicle: string | null;
  startDate: string;
  endDate: string;
  confirmed: boolean;
  totalRef: number | null;
  paidSoFar: number | null;
  balance: number | null;
  /** true = el total/saldo son de referencia (VikRentCar), no el contrato firmado en la entrega. */
  isEstimate: boolean;
};

type ReservationRow = Pick<
  Rental,
  "wpBookingId" | "status" | "bookingConfirmed" | "startAt" | "endAt" | "pricing" | "bookingTotal" | "bookingPaid"
> & { vehicle: Pick<Vehicle, "brand" | "model" | "name"> | null };

export function summarizeReservation(r: ReservationRow): ReservationSummary {
  const { label } = rentalStatusDisplay(r.status, r.bookingConfirmed);
  const payments = computeRentalPayments(r);
  return {
    bookingNumber: r.wpBookingId,
    statusLabel: label,
    vehicle: r.vehicle ? vehicleDisplayName(r.vehicle) : null,
    startDate: formatDate(r.startAt),
    endDate: formatDate(r.endAt),
    confirmed: r.bookingConfirmed,
    totalRef: payments.totalRef,
    paidSoFar: payments.paidSoFar,
    balance: payments.balance,
    isEstimate: !payments.hasContract,
  };
}

/**
 * Busca reservas del teléfono de la conversación — nunca de otro. Si viene
 * `bookingNumber` y no matchea ninguna reserva de ESE teléfono, devuelve `[]`
 * (nunca confirma ni niega que el número exista para otra persona).
 */
export async function findMyReservations(input: {
  phoneE164: string;
  bookingNumber?: string;
}): Promise<ReservationSummary[]> {
  let wpBookingId: number | undefined;
  if (input.bookingNumber !== undefined) {
    const n = Number(input.bookingNumber.trim());
    if (!Number.isInteger(n)) return [];
    wpBookingId = n;
  }

  const rentals = await prisma.rental.findMany({
    where: {
      clientPhone: { in: phoneVariants(input.phoneE164) },
      status: { in: RELEVANT_STATUSES },
      ...(wpBookingId !== undefined ? { wpBookingId } : {}),
    },
    orderBy: { startAt: "desc" },
    take: MAX_RESERVATIONS,
    select: {
      wpBookingId: true,
      status: true,
      bookingConfirmed: true,
      startAt: true,
      endAt: true,
      pricing: true,
      bookingTotal: true,
      bookingPaid: true,
      vehicle: { select: { brand: true, model: true, name: true } },
    },
  });
  return rentals.map(summarizeReservation);
}
