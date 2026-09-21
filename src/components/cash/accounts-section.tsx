import type { PaymentMethodOwnership } from "@prisma/client";
import { AccountCard } from "./account-card";
import type { OwnAccountBalance, CashMovementRow } from "@/lib/cash";

type PaymentMethodOption = { id: string; name: string; requiresNote?: boolean; ownership: PaymentMethodOwnership };
type ExpenseCategoryOption = { id: string; name: string };
type AccountWithLedger = OwnAccountBalance & { ledger: CashMovementRow[] };

/**
 * Saldo + movimientos de cada cuenta propia (Efectivo, banco, Mercado Pago,
 * etc.) — una `AccountCard` por cuenta principal. Solo admin (ver
 * `caja/page.tsx`): a diferencia de Proveedores/Asociados, esto es la
 * posición de plata real de la empresa.
 */
export function AccountsSection({
  accounts,
  paymentMethods,
  expenseCategories,
}: {
  accounts: AccountWithLedger[];
  paymentMethods: PaymentMethodOption[];
  expenseCategories: ExpenseCategoryOption[];
}) {
  if (accounts.length === 0) {
    return (
      <p className="rounded-lg border border-foreground/10 px-3 py-2 text-sm text-foreground/50">
        Todavía no hay cuentas propias configuradas. Agregalas en Configuración → Medios de pago (Tipo de cuenta:
        Propia).
      </p>
    );
  }

  const now = new Date();
  return (
    <div className="flex flex-col gap-3">
      {accounts.map((a) => (
        <AccountCard
          key={a.id}
          account={a}
          paymentMethods={paymentMethods}
          expenseCategories={expenseCategories}
          now={now}
        />
      ))}
    </div>
  );
}
