import "server-only";
import { formatArs } from "@/lib/contract";

/** Compartido entre CashMovementEdit y SafeMovementEdit (mismo shape en los dos). */
export type FieldChange = { field: string; from: string; to: string };

/**
 * Diff de detalle+monto al editar un movimiento (Caja o Caja fuerte): los dos
 * modelos comparten exactamente estos dos campos editables base; CashMovement
 * además compara sus propios campos (medio de pago, destino) por su cuenta.
 */
export function diffDescriptionAndAmount(
  existing: { description: string; amount: unknown },
  next: { description: string; amount: number },
  descriptionLabel: string,
): FieldChange[] {
  const changes: FieldChange[] = [];
  if (existing.description !== next.description) {
    changes.push({ field: descriptionLabel, from: existing.description, to: next.description });
  }
  if (Number(existing.amount) !== next.amount) {
    changes.push({ field: "Monto", from: formatArs(Number(existing.amount)), to: formatArs(next.amount) });
  }
  return changes;
}
