import Link from "next/link";
import { ChevronRightIcon } from "@/components/ui/icons";
import { FinanceOnlyBadge } from "./finance-only-badge";
import { formatBtc, formatMoney } from "@/lib/contract";
import { CURRENCIES, type CurrencyTotals } from "@/lib/currency";

/** "Aportado (neto): US$ X" — solo las monedas con algo; null si no hay nada. */
export function netContributedText(totals: CurrencyTotals): string | null {
  const shown = CURRENCIES.filter((c) => totals[c] !== 0);
  return shown.length > 0 ? shown.map((c) => formatMoney(totals[c], c)).join(" · ") : null;
}

/**
 * Tarjeta de una cuenta Bitcoin (ver `PaymentMethod.isBitcoin`) en Saldos:
 * saldo en BTC, su valor aproximado en dólares con el precio del día
 * (`getBtcPrice`) y lo aportado neto (pesos/dólares que se pusieron menos lo
 * que se sacó al vender). Va en su propia sección, fuera del saldo total: no
 * es plata disponible. Mismo formato que `AccountCard`, con un acento naranja
 * para distinguirla de un vistazo.
 */
export function BitcoinAccountCard({
  href,
  name,
  caption,
  btc,
  netContributed,
  btcUsdPrice,
  financeOnly,
}: {
  href: string;
  name: string;
  caption?: string;
  btc: number;
  netContributed: CurrencyTotals;
  /** Precio de 1 BTC en dólares; null si no se pudo obtener (se muestra sin valuación). */
  btcUsdPrice: number | null;
  financeOnly?: boolean;
}) {
  const contributed = netContributedText(netContributed);
  return (
    <Link
      href={href}
      className={`flex h-full flex-col gap-2 rounded-xl border p-3.5 transition-colors hover:bg-foreground/5 ${
        financeOnly ? "border-2 border-foreground bg-foreground/[0.04]" : "border-orange-500/40"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">{name}</h3>
          {caption && <p className="truncate text-xs text-foreground/50">{caption}</p>}
          {financeOnly && (
            <div className="mt-1">
              <FinanceOnlyBadge />
            </div>
          )}
        </div>
        <ChevronRightIcon className="size-4 shrink-0 text-foreground/30" />
      </div>
      <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{formatBtc(btc)}</p>
      <p className="text-xs text-foreground/60">
        {btcUsdPrice != null ? `≈ ${formatMoney(btc * btcUsdPrice, "usd")} hoy` : "Sin precio del BTC por ahora"}
      </p>
      <div className="mt-auto flex flex-col gap-0.5 border-t border-foreground/10 pt-2">
        <p className="text-xs text-foreground/50">Aportado (neto): {contributed ?? "—"}</p>
      </div>
    </Link>
  );
}
