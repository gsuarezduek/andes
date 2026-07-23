import type { Rental } from "@prisma/client";
import { computeBalance, type ContractPricing } from "@/lib/contract";

type RentalPaymentsInput = Pick<Rental, "pricing" | "bookingTotal" | "bookingPaid">;

export type RentalPayments = {
  hasContract: boolean;
  totalRef: number | null;
  paidSoFar: number | null;
  balance: number | null;
  showPayments: boolean;
};

/**
 * Pagos: antes de la entrega solo tenemos lo que trae VikRentCar (total de
 * referencia + pagado/anticipo, ej. cuando el cliente paga por privado y se
 * anota en la orden). Una vez hecha la entrega, el contrato cargado en el
 * wizard (rental.pricing) pasa a ser la fuente — puede diferir del de VikRentCar.
 */
export function computeRentalPayments(rental: RentalPaymentsInput): RentalPayments {
  const pricing = rental.pricing as ContractPricing | null;
  const hasContract = pricing != null && (pricing.total != null || pricing.sena != null || pricing.paid != null);
  const totalRef = hasContract ? (pricing!.total ?? null) : rental.bookingTotal ? Number(rental.bookingTotal) : null;
  const paidSoFar = hasContract
    ? (pricing!.sena ?? 0) + (pricing!.paid ?? 0)
    : rental.bookingPaid
      ? Number(rental.bookingPaid)
      : null;
  const balance = hasContract
    ? (pricing!.balance ?? computeBalance({ total: pricing!.total, sena: pricing!.sena, paid: pricing!.paid }))
    : totalRef != null && paidSoFar != null
      ? totalRef - paidSoFar
      : null;
  const showPayments = totalRef != null || paidSoFar != null;

  return { hasContract, totalRef, paidSoFar, balance, showPayments };
}
