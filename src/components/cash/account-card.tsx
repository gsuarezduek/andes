import Link from "next/link";
import { ChevronRightIcon } from "@/components/ui/icons";
import { CurrencyTotalsDisplay } from "./currency-totals-display";
import type { OwnAccountBalance } from "@/lib/cash";

/**
 * Tarjeta de una cuenta propia (Efectivo, banco, Mercado Pago, etc.): nombre
 * + saldo actual (histórico completo, ver `getOwnAccountBalances`), la
 * tarjeta entera clickeable hacia su página propia (`/caja/saldos/[id]`),
 * donde vive el historial completo agrupado por mes — pedido del dueño: sin
 * un link aparte de "Ver movimientos", el click es en cualquier parte de la
 * tarjeta.
 */
export function AccountCard({ account }: { account: OwnAccountBalance }) {
  return (
    <Link
      href={`/caja/saldos/${account.id}`}
      className="flex items-center gap-3 rounded-xl border border-foreground/10 p-3 transition-colors hover:bg-foreground/5"
    >
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold">{account.name}</h3>
        {account.subaccounts.length > 0 && (
          <p className="text-xs text-foreground/50">Incluye {account.subaccounts.map((s) => s.name).join(", ")}</p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <CurrencyTotalsDisplay totals={account.balance} size="text-base" />
      </div>
      <ChevronRightIcon className="size-4 shrink-0 text-foreground/30" />
    </Link>
  );
}
