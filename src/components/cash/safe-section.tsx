import type { ReactNode } from "react";
import { SectionTitle } from "@/components/ui/section-title";
import { formatMoney } from "@/lib/contract";
import { formatDateTime } from "@/lib/datetime";
import { CURRENCIES, type CurrencyTotals } from "@/lib/currency";
import { SafeMovementRow } from "./safe-movement-row";
import type { SafeMovementEditRow, SafeMovementRow as SafeMovementRowData } from "@/lib/safe";

/** Uno o más `moneda: monto` en línea, separados por " · " — pesos siempre
 *  (aunque sea $0), dólares solo si hay saldo en esa moneda. */
function InlineCurrencyTotals({ totals }: { totals: CurrencyTotals }) {
  return (
    <>
      {CURRENCIES.filter((c) => c === "ars" || totals[c] !== 0)
        .map((c) => (
          <span key={c} className={totals[c] < 0 ? "text-red-600" : ""}>
            {formatMoney(totals[c], c)}
          </span>
        ))
        .reduce<ReactNode[]>((acc, node, i) => (i === 0 ? [node] : [...acc, " · ", node]), [])}
    </>
  );
}

/**
 * Caja fuerte: saldo, billetera e historial son solo para admin (`null` para
 * no-admin, que sigue pudiendo cargar un ingreso/retiro desde `SafeLauncher`
 * pero no ve nada de esto — a diferencia del resto de Caja, acá ni el propio
 * historial es visible: es efectivo físico real). Editar/borrar
 * (`SafeMovementRow`) va con el resto de lo admin-only. Los saldos van
 * separados por moneda (ver `src/lib/currency.ts`) — nunca sumados entre sí.
 */
export function SafeSection({
  movements,
  balance,
  walletBalance,
  edits,
}: {
  movements: SafeMovementRowData[] | null;
  balance: CurrencyTotals | null;
  walletBalance: CurrencyTotals | null;
  edits?: SafeMovementEditRow[];
}) {
  const isAdmin = movements !== null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle>Caja fuerte</SectionTitle>
        {balance !== null && (
          <span className="text-sm font-semibold">
            Saldo: <InlineCurrencyTotals totals={balance} />
          </span>
        )}
      </div>
      <p className="-mt-2 text-xs text-foreground/50">
        Efectivo físico guardado — no se relaciona con los ingresos/egresos de reservas (pestaña
        Movimientos).
      </p>
      {walletBalance !== null && (
        <div className="-mt-1 flex items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
          <div>
            <p className="text-sm font-medium">Billetera</p>
            <p className="text-xs text-foreground/50">
              Efectivo en mano, todavía sin depositar acá.
            </p>
          </div>
          <span className="shrink-0 text-sm font-semibold">
            <InlineCurrencyTotals totals={walletBalance} />
          </span>
        </div>
      )}

      {movements === null ? (
        <p className="rounded-lg border border-foreground/10 px-3 py-2 text-sm text-foreground/50">
          El saldo y el historial de caja fuerte son visibles solo para administradores.
        </p>
      ) : movements.length === 0 ? (
        <p className="rounded-lg border border-foreground/10 px-3 py-2 text-sm text-foreground/50">
          Sin movimientos.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {movements.map((m) => (
            <SafeMovementRow key={`${m.id}:${m.description}:${m.amount}`} movement={m} />
          ))}
        </ul>
      )}

      {isAdmin && edits && edits.length > 0 && (
        <div className="mt-2 flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
            Historial de ediciones (caja fuerte)
          </h3>
          <ul className="flex flex-col gap-2">
            {edits.map((e) => (
              <li key={e.id} className="rounded-lg border border-foreground/10 px-3 py-2 text-sm">
                <p className={e.action === "deleted" ? "text-red-600" : ""}>
                  {e.action === "deleted"
                    ? `Eliminado — ${e.movementDescription} (${formatMoney(e.movementAmount, e.movementCurrency)})`
                    : (e.changes ?? []).map((c) => `${c.field}: ${c.from} → ${c.to}`).join(" · ")}
                </p>
                <p className="mt-1 text-xs text-foreground/50">
                  {e.editedByName} · {formatDateTime(e.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
