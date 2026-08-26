import "server-only";
import { getThirdPartyBalances, getThirdPartyLedger } from "@/lib/third-party-accounts";
import type { ThirdPartyBalance, ThirdPartyLedgerRow } from "@/lib/third-party-accounts";

export type ProviderBalance = ThirdPartyBalance;
export type ProviderLedgerRow = ThirdPartyLedgerRow;

/**
 * Saldo de cuenta corriente de cada proveedor (`PaymentMethod.ownership =
 * "provider"`). Ver `getThirdPartyBalances` — mismo mecanismo que Asociados
 * (`src/lib/associates.ts`), solo cambia el `ownership`.
 */
export function getProviderBalances(): Promise<ProviderBalance[]> {
  return getThirdPartyBalances("provider");
}

/** Historial completo de un proveedor — ver `getThirdPartyLedger`. */
export function getProviderLedger(providerId: string): Promise<ProviderLedgerRow[]> {
  return getThirdPartyLedger(providerId);
}
