import { SectionTitle } from "@/components/ui/section-title";
import { CurrencyTotalsDisplay } from "./currency-totals-display";
import { FundMovementLauncher } from "./fund-movement-launcher";
import { FundMovementList } from "./fund-movement-list";
import type { CurrencyTotals } from "@/lib/currency";
import type { FundMovementRow } from "@/lib/investment-funds-queries";

/**
 * "Fondos de inversión" de una cuenta propia (`/caja/saldos/[id]`, arriba de
 * los resúmenes mensuales): saldo actual del fondo + depositar/retirar +
 * historial. Puramente informativo — no afecta el saldo de Caja de la cuenta
 * (ver `PaymentMethod.hasInvestmentFunds` en el schema). Solo se renderiza si
 * la cuenta tiene el flag activado (Configuración → Medios de pago).
 */
export function FundsSection({
  paymentMethodId,
  balance,
  movements,
}: {
  paymentMethodId: string;
  balance: CurrencyTotals;
  movements: FundMovementRow[];
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-violet-500/25 bg-violet-500/[0.04] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <SectionTitle>Fondos de inversión</SectionTitle>
          <div className="mt-1">
            <CurrencyTotalsDisplay totals={balance} size="text-xl" />
          </div>
        </div>
        <FundMovementLauncher paymentMethodId={paymentMethodId} />
      </div>
      <FundMovementList movements={movements} />
    </div>
  );
}
