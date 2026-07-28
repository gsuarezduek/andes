import type { Rental, RentalStatus } from "@prisma/client";
import { computeBalance, type ContractPricing } from "@/lib/contract";

type RentalPaymentsInput = Pick<Rental, "pricing" | "bookingTotal" | "bookingPaid">;

export type RentalPayments = {
  hasContract: boolean;
  /** true si `paidSoFar` sale de un pago real cargado en Andes (contrato de
   *  la entrega o el botón "Agregar pago"), no del dato de referencia de
   *  VikRentCar — independiente de si ya hay un `total` de contrato. */
  hasRealPaid: boolean;
  totalRef: number | null;
  paidSoFar: number | null;
  balance: number | null;
  showPayments: boolean;
};

/**
 * Pagos: antes de la entrega solo tenemos lo que trae VikRentCar (total de
 * referencia + pagado/anticipo, ej. cuando el cliente paga por privado y se
 * anota en la orden), salvo que ya se haya cargado un pago rápido desde esta
 * pantalla (botón "Agregar pago", antes de la entrega) — ese sí es real y
 * tiene prioridad sobre `bookingPaid`. Una vez hecha la entrega, el contrato
 * cargado en el wizard (`rental.pricing.total`) pasa a ser la fuente del
 * total — puede diferir del de VikRentCar. `hasContract` sólo refleja si ya
 * hay un total de contrato cargado (no si ya se cargó algún pago), para no
 * perder la referencia de VikRentCar apenas se anota la primera seña.
 */
export function computeRentalPayments(rental: RentalPaymentsInput): RentalPayments {
  const pricing = rental.pricing as ContractPricing | null;
  const hasContract = pricing?.total != null;
  const totalRef = pricing?.total ?? (rental.bookingTotal ? Number(rental.bookingTotal) : null);
  const paidFromContract = pricing != null && (pricing.paid != null || pricing.sena != null);
  const paidSoFar = paidFromContract
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

  return { hasContract, hasRealPaid: paidFromContract, totalRef, paidSoFar, balance, showPayments };
}

export type PaymentAccent = "complete" | "pending" | null;

/**
 * Marca visual de pago para Calendario/Alquileres/Home: solo tiene sentido en
 * `active` o `reserved` ya confirmada (verde/ámbar) — una reserva pendiente o
 * cancelada todavía no tiene por qué tener seña. `null` cubre tanto "no
 * aplica" como "no hay datos suficientes para saber" (mismo tratamiento
 * visual: no se resalta nada porque no hay una alerta real que mostrar).
 */
export function paymentAccent(
  status: RentalStatus,
  bookingConfirmed: boolean,
  payments: Pick<RentalPayments, "balance">,
): PaymentAccent {
  const applies = status === "active" || (status === "reserved" && bookingConfirmed);
  if (!applies || payments.balance == null) return null;
  return payments.balance <= 0 ? "complete" : "pending";
}
