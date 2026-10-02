import type { CashMovementRow as CashMovementRowData } from "@/lib/cash";

/**
 * Key de React para una fila de `MovementRow`: incluye los campos editables
 * para que, tras guardar una edición, el componente se remonte con los
 * valores nuevos en vez de quedar con el form pegado al `defaultValue` viejo.
 *
 * Vive en su propio módulo (sin `"use client"`) a propósito: es una función
 * pura que también usan componentes de servidor (`incomes-board.tsx`,
 * `cash-own-list.tsx`, `guarantees-section.tsx`) para calcular el `key` de la
 * lista — si viviera en `movement-row.tsx` (que sí es `"use client"`), Next
 * trata TODO export de ese archivo como una referencia de cliente, y llamarla
 * como función normal desde un Server Component revienta en runtime
 * ("Attempted to call movementRowKey() from the server but movementRowKey is
 * on the client").
 */
export function movementRowKey(movement: CashMovementRowData): string {
  return `${movement.id}:${movement.description}:${movement.amount}:${movement.currency}:${movement.paymentMethodName}:${movement.paymentMethodNote ?? ""}:${movement.recipientPaymentMethodName ?? ""}:${movement.recipientPaymentMethodNote ?? ""}:${movement.categoryName ?? ""}`;
}
