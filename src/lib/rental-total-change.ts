/**
 * Cambio del total de una orden en VikRentCar con el contrato ya cargado. Lógica
 * pura, compartida entre el sync (`booking-upsert.ts`) y el aviso de la reserva.
 */
import { roundMoney } from "@/lib/contract";
import type { RentalStatus } from "@prisma/client";

/**
 * ¿Hay que avisar? Solo si el saldo sale del contrato (sin `contractTotal`, el
 * saldo ya usa el total de VikRentCar y se actualiza solo) y sabemos los dos
 * valores (null = la orden no lo trae o el plugin no comparte lo económico).
 * Si en la misma corrida se detectó una extensión, la diferencia es ese cobro:
 * ya tiene su propio aviso, avisar acá también invitaría a cobrarla dos veces.
 */
export function shouldTrackTotalChange(input: {
  status: RentalStatus;
  contractTotal: number | null | undefined;
  previousTotal: number | null;
  nextTotal: number | null;
  extensionDetected: boolean;
}): boolean {
  const { status, contractTotal, previousTotal, nextTotal, extensionDetected } = input;
  if (status !== "active" && status !== "finished") return false;
  if (contractTotal == null || previousTotal == null || nextTotal == null) return false;
  return !extensionDetected && totalDifference(previousTotal, nextTotal) !== 0;
}

/** Diferencia con signo, redondeada a centavos. */
export function totalDifference(previousTotal: number, nextTotal: number): number {
  return roundMoney(nextTotal - previousTotal);
}

/** "+$ 1.000" / "-$ 1.000": `formatArs` no marca el "+" de un importe positivo. */
export function formatSignedAmount(amount: number, format: (v: number) => string): string {
  return `${amount < 0 ? "-" : "+"}${format(Math.abs(amount))}`;
}
