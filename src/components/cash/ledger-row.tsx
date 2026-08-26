import { formatMoney } from "@/lib/contract";
import { formatDateTime } from "@/lib/datetime";
import { DebtRow } from "./debt-row";
import type { ThirdPartyLedgerRow } from "@/lib/third-party-accounts";

/**
 * Una fila del historial de una cuenta ajena (proveedor o asociado) — deuda,
 * pago directo del cliente, o pago de la empresa. Compartido por
 * `ProviderCard`/`AssociateCard` (mismo tipo de dato, ver
 * `src/lib/third-party-accounts.ts`).
 */
export function LedgerRow({
  movement,
  isAdmin,
  principalName,
}: {
  movement: ThirdPartyLedgerRow;
  isAdmin: boolean;
  principalName: string;
}) {
  if (movement.kind === "debt") return <DebtRow movement={movement} isAdmin={isAdmin} />;
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
        {movement.kind === "client_payment" ? "Pago directo del cliente" : "Pagado por la empresa"} ·{" "}
        {movement.createdByName} · {formatDateTime(movement.createdAt)}
        {viaSubaccount && ` · vía ${movement.accountName}`}
      </p>
    </li>
  );
}
