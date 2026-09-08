import Link from "next/link";
import { formatDateTime } from "@/lib/datetime";
import type { CashMovementRow } from "@/lib/cash";

/**
 * Línea de metadatos de un movimiento (cuenta, cliente, quién lo cargó,
 * fecha) — con etiquetas explícitas en vez de segmentos separados por "·"
 * sin aclarar qué es cada uno (antes se leía ambiguo, ej. un "—" suelto que
 * en realidad significa "cargado automático desde VikRentCar", ver
 * `AUTO_IMPORT_CREATOR_LABEL`). Compartida por `MovementRow`, `IncomesBoard`
 * y `CashOwnList` — misma forma de dato (`CashMovementRow`), mismo formato.
 * El cliente linkea a la reserva vinculada cuando hay una (`rentalId`).
 */
export function MovementMetaLine({ movement }: { movement: CashMovementRow }) {
  const accountLabel = movement.type === "income" ? "Cuenta destino" : "Origen";
  return (
    <>
      <p className="mt-1 text-xs text-foreground/50">
        {accountLabel}: {movement.paymentMethodName}
        {movement.paymentMethodNote ? ` (${movement.paymentMethodNote})` : ""}
        {movement.recipientPaymentMethodName
          ? ` → Destino: ${movement.recipientPaymentMethodName}${
              movement.recipientPaymentMethodNote ? ` (${movement.recipientPaymentMethodNote})` : ""
            }`
          : ""}
        {movement.rentalClientName ? (
          <>
            {" · Cliente: "}
            {movement.rentalId ? (
              <Link href={`/rentals/${movement.rentalId}`} className="underline hover:text-foreground/70">
                {movement.rentalClientName}
              </Link>
            ) : (
              movement.rentalClientName
            )}
          </>
        ) : null}
        {` · Cargado por: ${movement.createdByName}`} · {formatDateTime(movement.createdAt)}
      </p>
      {movement.lastEditedAt && (
        <p className="mt-0.5 text-xs text-foreground/50">
          Editado por: {movement.lastEditedByName ?? "—"} · {formatDateTime(movement.lastEditedAt)}
        </p>
      )}
    </>
  );
}
