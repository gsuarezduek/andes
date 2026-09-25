import Link from "next/link";
import { ChevronRightIcon } from "@/components/ui/icons";
import { CurrencyTotalsDisplay } from "./currency-totals-display";
import { formatMoney } from "@/lib/contract";
import { CURRENCIES, type CurrencyTotals } from "@/lib/currency";

/** "Ingresos: $X" / "Egresos: $X", una línea por moneda con movimiento — chico, al pie de la tarjeta. */
function MonthLine({ label, totals }: { label: string; totals: CurrencyTotals }) {
  const shown = CURRENCIES.filter((c) => c === "ars" || totals[c] !== 0);
  return (
    <p className="truncate text-xs text-foreground/50">
      {label}: {shown.map((c) => formatMoney(totals[c], c)).join(" · ")}
    </p>
  );
}

/**
 * Tarjeta de una cuenta propia (Efectivo, banco, Mercado Pago, Caja fuerte,
 * etc.): nombre + saldo actual arriba, ingresos/egresos de este mes chico
 * abajo — más cuadrada que horizontal para poder mostrar varias por fila
 * (pedido del dueño). Tarjeta entera clickeable hacia la página con el
 * historial completo. Genérica (no depende de `OwnAccountBalance`/
 * `PaymentMethod`) para que la Caja fuerte pueda usarla igual que el resto
 * (ver `AccountsSection`, v44).
 */
export function AccountCard({
  href,
  name,
  caption,
  balance,
  monthIncome,
  monthExpense,
}: {
  href: string;
  name: string;
  /** Aclaración chica bajo el nombre (subcuentas incluidas, o "Efectivo físico" para la Caja fuerte). */
  caption?: string;
  balance: CurrencyTotals;
  monthIncome: CurrencyTotals;
  monthExpense: CurrencyTotals;
}) {
  return (
    <Link
      href={href}
      className="flex h-full flex-col gap-2 rounded-xl border border-foreground/10 p-3.5 transition-colors hover:bg-foreground/5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">{name}</h3>
          {caption && <p className="truncate text-xs text-foreground/50">{caption}</p>}
        </div>
        <ChevronRightIcon className="size-4 shrink-0 text-foreground/30" />
      </div>
      <div>
        <CurrencyTotalsDisplay totals={balance} size="text-lg" />
      </div>
      <div className="mt-auto flex flex-col gap-0.5 border-t border-foreground/10 pt-2">
        <MonthLine label="Ingresos" totals={monthIncome} />
        <MonthLine label="Egresos" totals={monthExpense} />
      </div>
    </Link>
  );
}
