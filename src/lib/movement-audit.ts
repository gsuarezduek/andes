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

/**
 * Diff genérico campo por campo entre dos objetos planos (ej. antes/después
 * de guardar Configuración → Condiciones), con formato de valor a cargo del
 * caller. `labels` define qué campos comparar y cómo se llaman en el
 * historial; los campos no listados se ignoran. Trata `null`/`undefined`/`""`
 * como "vacío" equivalentes entre sí (no genera un cambio falso).
 */
export function diffFields<T extends Record<string, unknown>>(
  existing: T,
  next: T,
  labels: Partial<Record<keyof T, string>>,
  formatValue: (key: keyof T, v: unknown) => string,
): FieldChange[] {
  const isEmpty = (v: unknown) => v == null || v === "";
  const changes: FieldChange[] = [];
  for (const key of Object.keys(labels) as (keyof T)[]) {
    const a = existing[key];
    const b = next[key];
    if (a === b) continue;
    if (isEmpty(a) && isEmpty(b)) continue;
    changes.push({ field: labels[key]!, from: formatValue(key, a), to: formatValue(key, b) });
  }
  return changes;
}
