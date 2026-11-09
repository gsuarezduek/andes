import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-helpers";
import { hasFinanceAccess } from "@/lib/user-permissions";
import { ButtonLink } from "@/components/ui/button";
import { CurrencyTotalsDisplay } from "@/components/cash/currency-totals-display";
import { SafeSection } from "@/components/cash/safe-section";
import { CajaSectionNav } from "@/components/cash/caja-section-nav";
import { getAllSafeMovements, getSafeBalance, getSafeMovementEdits } from "@/lib/safe";
import { getOwnAccountBalances, getWalletBalance } from "@/lib/cash";
import { getCurrentUsdRate } from "@/lib/usd-rate-queries";
import { buildTransferOptions, SAFE_ACCOUNT_ID } from "@/lib/account-transfers";
import { financeOnlyAccountIds } from "@/lib/finance-only";
import { TransferLauncher } from "@/components/cash/transfer-launcher";
import { getAccountTransfers } from "@/lib/account-transfers-queries";

export const metadata: Metadata = { title: "Caja fuerte — Caja — Andes" };

/**
 * Historial completo de la Caja fuerte — mismo patrón que
 * `/caja/saldos/[id]` para una cuenta propia (título + saldo grande arriba,
 * "Volver a Caja" abajo). Ruta estática, no `[id]`: la Caja fuerte no es un
 * `PaymentMethod` (ver `SAFE_ACCOUNT_ID`). Ya no tiene su propia pestaña en
 * Caja — es una tarjeta más en Saldos (`AccountsSection`, v44). Admin-only,
 * mismo criterio que el resto de Saldos.
 */
export default async function SafeAccountPage() {
  const user = await requireAdmin();
  const canSeeFinanceOnly = hasFinanceAccess(user.role, user.owner);
  const financeOnlyIds = await financeOnlyAccountIds(canSeeFinanceOnly);

  const [balance, walletBalance, movements, edits, transfers, accounts, usdRate] = await Promise.all([
    getSafeBalance(),
    getWalletBalance(canSeeFinanceOnly),
    getAllSafeMovements(),
    getSafeMovementEdits(),
    getAccountTransfers({ safe: true, limit: 50, maskAccountIds: financeOnlyIds }),
    getOwnAccountBalances(canSeeFinanceOnly),
    getCurrentUsdRate(),
  ]);
  // La Caja fuerte solo se mueve con traspasos (no tiene ingresos/egresos propios).
  const transferOptions = buildTransferOptions(accounts, balance);
  const fixedSafe = transferOptions.options.filter((a) => a.id === SAFE_ACCOUNT_ID);

  return (
    <div className="flex flex-col gap-6">
      <CajaSectionNav active="saldos" />

      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Caja fuerte</h1>
        <div className="shrink-0 text-right">
          <CurrencyTotalsDisplay totals={balance} size="text-xl" />
        </div>
      </div>

      <TransferLauncher
        accounts={transferOptions.options}
        balances={transferOptions.balances}
        usdRate={usdRate?.rate ?? null}
        fixedAccounts={fixedSafe}
        buttonClassName="w-full"
      />

      <SafeSection movements={movements} transfers={transfers} walletBalance={walletBalance} edits={edits} />

      <ButtonLink href="/caja" variant="secondary">
        Volver a Caja
      </ButtonLink>
    </div>
  );
}
