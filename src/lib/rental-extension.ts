/**
 * Extensión de un alquiler ya entregado (el cliente pide más días, típico al
 * momento de la devolución). Lógica pura para calcular días extra e importe
 * sugerido — compartida entre el formulario y la acción que persiste
 * (`extendRental`, `extension-actions.ts`).
 */
import { roundMoney } from "@/lib/contract";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Días extra entre la fecha de devolución pactada y la nueva fecha, redondeado
 * hacia arriba (un día empezado se cuenta entero, mismo criterio que "días" en
 * el resto del contrato). 0 si la nueva fecha no es posterior.
 */
export function extensionExtraDays(previousEndAt: Date, newEndAt: Date): number {
  const diff = newEndAt.getTime() - previousEndAt.getTime();
  return diff > 0 ? Math.ceil(diff / MS_PER_DAY) : 0;
}

/**
 * Cargo sugerido = tarifa diaria del contrato × días extra. `null` si falta
 * la tarifa — el empleado carga el importe a mano en ese caso.
 */
export function suggestedExtensionAmount(
  dailyRate: number | null | undefined,
  extraDays: number,
): number | null {
  if (dailyRate == null || !Number.isFinite(dailyRate) || extraDays <= 0) return null;
  return roundMoney(dailyRate * extraDays);
}
