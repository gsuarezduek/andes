import Link from "next/link";
import { CurrencyTotalsDisplay } from "./currency-totals-display";
import type { OwnAccountBalance } from "@/lib/cash";

/**
 * Tarjeta de una cuenta propia (Efectivo, banco, Mercado Pago, etc.): nombre
 * + saldo actual (histórico completo, ver `getOwnAccountBalances`) + un link
 * a su página propia (`/caja/saldos/[id]`), donde vive el historial completo
 * agrupado por mes. Antes el historial se expandía acá mismo (inline); ahora
 * es una página aparte para no amontonar varias cuentas en una sola pantalla
 * larga — pedido del dueño.
 */
export function AccountCard({ account }: { account: OwnAccountBalance & { movementCount: number } }) {
  return (
    <section className="rounded-xl border border-foreground/10 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{account.name}</h3>
          {account.subaccounts.length > 0 && (
            <p className="text-xs text-foreground/50">
              Incluye {account.subaccounts.map((s) => s.name).join(", ")}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <CurrencyTotalsDisplay totals={account.balance} size="text-base" />
        </div>
      </div>

      <Link
        href={`/caja/saldos/${account.id}`}
        className="mt-3 block text-xs font-medium text-foreground/60 underline hover:text-foreground/80"
      >
        Ver movimientos ({account.movementCount})
      </Link>
    </section>
  );
}
