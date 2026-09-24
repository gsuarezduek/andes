import { AccountCard } from "./account-card";
import { TransferLauncher, type TransferAccountOption } from "./transfer-launcher";
import { TransferList } from "./transfer-list";
import { SectionTitle } from "@/components/ui/section-title";
import { SAFE_ACCOUNT_ID, SAFE_ACCOUNT_NAME } from "@/lib/account-transfers";
import type { CurrencyTotals } from "@/lib/currency";
import type { OwnAccountBalance } from "@/lib/cash";
import type { AccountTransferRow } from "@/lib/account-transfers-queries";

/**
 * Saldo de cada cuenta propia (Efectivo, banco, Mercado Pago, etc.) — una
 * `AccountCard` por cuenta principal, que linkea a `/caja/saldos/[id]` para
 * ver su historial (ya no se expande inline, ver `AccountCard`). Solo admin
 * (ver `caja/page.tsx`): a diferencia de Proveedores/Asociados, esto es la
 * posición de plata real de la empresa.
 */
export function AccountsSection({
  accounts,
  transfers,
  usdRate,
  safeBalance,
}: {
  accounts: OwnAccountBalance[];
  /** Saldo actual de la Caja fuerte — también es origen/destino de un traspaso. */
  safeBalance: CurrencyTotals;
  /** Últimos traspasos entre cuentas ("Mover entre cuentas"). */
  transfers: AccountTransferRow[];
  usdRate: number | null;
}) {
  if (accounts.length === 0) {
    return (
      <p className="rounded-lg border border-foreground/10 px-3 py-2 text-sm text-foreground/50">
        Todavía no hay cuentas propias configuradas. Agregalas en Configuración → Medios de pago (Tipo de cuenta:
        Propia).
      </p>
    );
  }

  // Cuentas elegibles como origen/destino (principales + subcuentas) y el saldo
  // de cada principal, para avisar si un traspaso dejaría el origen en negativo.
  const options: TransferAccountOption[] = [
    ...accounts.flatMap((a) => [
      { id: a.id, name: a.name, principalId: a.id },
      ...a.subaccounts.map((s) => ({ id: s.id, name: `${a.name} · ${s.name}`, principalId: a.id })),
    ]),
    { id: SAFE_ACCOUNT_ID, name: SAFE_ACCOUNT_NAME, principalId: SAFE_ACCOUNT_ID },
  ];
  const balances = { ...Object.fromEntries(accounts.map((a) => [a.id, a.balance])), [SAFE_ACCOUNT_ID]: safeBalance };

  return (
    <div className="flex flex-col gap-4">
      <TransferLauncher accounts={options} balances={balances} usdRate={usdRate} />
      <div className="flex flex-col gap-3">
        {accounts.map((a) => (
          <AccountCard key={a.id} account={a} />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <SectionTitle>Últimos traspasos</SectionTitle>
        <TransferList transfers={transfers} />
      </div>
    </div>
  );
}
