import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { WhatsappAccountLink } from "./whatsapp-link";
import { BalanceLine } from "./balance-line";
import { ThirdPartyLedgerMonths } from "./third-party-ledger-months";
import { groupProviderLedgerByMonth } from "@/lib/provider-ledger-grouping";
import { formatDateInput } from "@/lib/datetime";
import type { ThirdPartyBalance, ThirdPartyLedgerRow } from "@/lib/third-party-accounts";

type PaymentMethodOption = { id: string; name: string; requiresNote?: boolean };

/**
 * Página individual de una cuenta ajena (proveedor o asociado) —
 * `/caja/proveedores/[id]` y `/caja/asociados/[id]`, mismo layout que
 * `/caja/saldos/[id]`: título + saldo alineados, botones de alta rápida
 * (`quickActions`, específicos de cada ownership), historial completo
 * agrupado por mes. `quickActions` es un slot para no duplicar esta página
 * entre proveedor/asociado, que solo difieren en qué formularios ofrecen.
 */
export function ThirdPartyAccountDetail({
  account,
  ledger,
  isAdmin,
  paymentMethods,
  quickActions,
}: {
  account: ThirdPartyBalance;
  ledger: ThirdPartyLedgerRow[];
  isAdmin: boolean;
  paymentMethods: PaymentMethodOption[];
  quickActions: ReactNode;
}) {
  const groups = groupProviderLedgerByMonth(ledger, new Date());
  const currentMonthKey = formatDateInput(new Date()).slice(0, 7);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{account.name}</h1>
          {account.subaccounts.length > 0 && (
            <p className="text-sm text-foreground/60">Incluye {account.subaccounts.map((s) => s.name).join(", ")}</p>
          )}
          {account.whatsappConversationId && (
            <div className="mt-1">
              <WhatsappAccountLink conversationId={account.whatsappConversationId} />
            </div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <BalanceLine balance={account.balance} />
        </div>
      </div>

      {quickActions}

      <ThirdPartyLedgerMonths
        groups={groups}
        currentMonthKey={currentMonthKey}
        principalName={account.name}
        isAdmin={isAdmin}
        paymentMethods={paymentMethods}
        accountOptions={[{ id: account.id, name: account.name }, ...account.subaccounts]}
      />

      <ButtonLink href="/caja" variant="secondary">
        Volver a Caja
      </ButtonLink>
    </div>
  );
}
