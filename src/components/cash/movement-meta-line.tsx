import { formatDateTime } from "@/lib/datetime";
import type { CashMovementRow } from "@/lib/cash";

/**
 * Línea de metadatos de un movimiento (cuenta, cliente, quién lo cargó,
 * fecha) — con etiquetas explícitas en vez de segmentos separados por "·"
 * sin aclarar qué es cada uno (antes se leía ambiguo, ej. un "—" suelto que
 * en realidad significa "cargado automático desde VikRentCar", ver
 * `AUTO_IMPORT_CREATOR_LABEL`). Compartida por `MovementRow`, `IncomesBoard`
 * y `CashOwnList` — misma forma de dato (`CashMovementRow`), mismo formato.
 */
export function MovementMetaLine({ movement }: { movement: CashMovementRow }) {
  const accountLabel = movement.type === "income" ? "Cuenta destino" : "Origen";
  return (
    <p className="mt-1 text-xs text-foreground/50">
      {accountLabel}: {movement.paymentMethodName}
      {movement.paymentMethodNote ? ` (${movement.paymentMethodNote})` : ""}
      {movement.recipientPaymentMethodName
        ? ` → Destino: ${movement.recipientPaymentMethodName}${
            movement.recipientPaymentMethodNote ? ` (${movement.recipientPaymentMethodNote})` : ""
          }`
        : ""}
      {movement.rentalClientName ? ` · Cliente: ${movement.rentalClientName}` : ""}
      {` · Cargado por: ${movement.createdByName}`} · {formatDateTime(movement.createdAt)}
    </p>
  );
}
