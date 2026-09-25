import { AccountMovementRow } from "./account-movement-row";
import type { ThirdPartyLedgerRow } from "@/lib/third-party-accounts";

type PaymentMethodOption = { id: string; name: string; requiresNote?: boolean };

/**
 * Una fila del historial de una cuenta ajena (proveedor o asociado) — deuda,
 * pago directo del cliente, o pago de la empresa. Compartido por las páginas
 * de proveedor y asociado (mismo tipo de dato, ver
 * `src/lib/third-party-accounts.ts`). Los tres tipos usan el mismo formato de
 * `AccountMovementRow`; el pago directo del cliente queda de solo lectura ahí
 * adentro.
 */
export function LedgerRow(props: {
  movement: ThirdPartyLedgerRow;
  isAdmin: boolean;
  principalName: string;
  paymentMethods: PaymentMethodOption[];
  accountOptions: { id: string; name: string; requiresNote?: boolean; parentId?: string | null }[];
}) {
  return <AccountMovementRow {...props} />;
}
