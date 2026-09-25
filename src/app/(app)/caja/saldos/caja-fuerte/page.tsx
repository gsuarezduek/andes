import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-helpers";
import { ButtonLink } from "@/components/ui/button";
import { CurrencyTotalsDisplay } from "@/components/cash/currency-totals-display";
import { SafeSection } from "@/components/cash/safe-section";
import { getAllSafeMovements, getSafeBalance, getSafeMovementEdits } from "@/lib/safe";
import { getWalletBalance } from "@/lib/cash";
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
  await requireAdmin();

  const [balance, walletBalance, movements, edits, transfers] = await Promise.all([
    getSafeBalance(),
    getWalletBalance(),
    getAllSafeMovements(),
    getSafeMovementEdits(),
    getAccountTransfers({ safe: true, limit: 50 }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Caja fuerte</h1>
        <div className="shrink-0 text-right">
          <CurrencyTotalsDisplay totals={balance} size="text-xl" />
        </div>
      </div>

      <SafeSection movements={movements} transfers={transfers} walletBalance={walletBalance} edits={edits} />

      <ButtonLink href="/caja" variant="secondary">
        Volver a Caja
      </ButtonLink>
    </div>
  );
}
