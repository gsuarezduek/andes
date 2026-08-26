import "server-only";
import { getThirdPartyBalances, getThirdPartyLedger } from "@/lib/third-party-accounts";
import type { ThirdPartyBalance, ThirdPartyLedgerRow } from "@/lib/third-party-accounts";

export type AssociateBalance = ThirdPartyBalance;
export type AssociateLedgerRow = ThirdPartyLedgerRow;

/**
 * Saldo de cuenta corriente de cada asociado (`PaymentMethod.ownership =
 * "associate"`). Ver `getThirdPartyBalances` — mismo mecanismo que
 * Proveedores (`src/lib/providers.ts`), solo cambia el `ownership`: cuando
 * alguien paga algo que le correspondía a la empresa (ej. un empleado cubrió
 * un gasto de su bolsillo), se carga como "deuda" y se salda después con un
 * ingreso (cliente le pagó directo) o un egreso (la empresa le devolvió la
 * plata).
 */
export function getAssociateBalances(): Promise<AssociateBalance[]> {
  return getThirdPartyBalances("associate");
}

/** Historial completo de un asociado — ver `getThirdPartyLedger`. */
export function getAssociateLedger(associateId: string): Promise<AssociateLedgerRow[]> {
  return getThirdPartyLedger(associateId);
}
