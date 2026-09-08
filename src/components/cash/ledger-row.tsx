import Link from "next/link";
import { formatMoney } from "@/lib/contract";
import { formatDateTime } from "@/lib/datetime";
import { AccountMovementRow } from "./account-movement-row";
import type { ThirdPartyLedgerRow } from "@/lib/third-party-accounts";

type PaymentMethodOption = { id: string; name: string; requiresNote?: boolean };

/**
 * Una fila del historial de una cuenta ajena (proveedor o asociado) — deuda,
 * pago directo del cliente, o pago de la empresa. Compartido por
 * `ProviderCard`/`AssociateCard` (mismo tipo de dato, ver
 * `src/lib/third-party-accounts.ts`). Deuda y Pago son editables (incluido
 * el tipo mismo — ver `AccountMovementRow`); el pago directo del cliente
 * sigue siendo de solo lectura acá (no se carga con los botones de esta
 * sección, no tiene sentido convertirlo).
 */
export function LedgerRow({
  movement,
  isAdmin,
  principalName,
  paymentMethods,
}: {
  movement: ThirdPartyLedgerRow;
  isAdmin: boolean;
  principalName: string;
  paymentMethods: PaymentMethodOption[];
}) {
  if (movement.kind === "debt" || movement.kind === "company_payment") {
    return (
      <AccountMovementRow
        movement={movement}
        isAdmin={isAdmin}
        principalName={principalName}
        paymentMethods={paymentMethods}
      />
    );
  }
  // Si la cuenta real usada es una subcuenta (no la principal), lo aclara —
  // la vista sigue unificada, pero no se pierde por dónde salió/entró la plata.
  const viaSubaccount = movement.accountName && movement.accountName !== principalName;
  return (
    <li className="rounded-lg border border-foreground/10 px-3 py-2 text-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 whitespace-pre-wrap">{movement.description}</p>
        <p className="shrink-0 font-semibold text-emerald-600">−{formatMoney(movement.amount, movement.currency)}</p>
      </div>
      <p className="mt-1 text-xs text-foreground/50">
        Pago directo del cliente · Cargado por: {movement.createdByName} · {formatDateTime(movement.createdAt)}
        {viaSubaccount && ` · vía ${movement.accountName}`}
        {movement.rentalId && (
          <>
            {" · "}
            <Link href={`/rentals/${movement.rentalId}`} className="underline hover:text-foreground/70">
              Ver reserva{movement.rentalClientName ? ` (${movement.rentalClientName})` : ""}
            </Link>
          </>
        )}
      </p>
    </li>
  );
}
