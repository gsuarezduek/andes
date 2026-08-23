import { formatMoney } from "@/lib/contract";
import { formatDateTime } from "@/lib/datetime";
import { CURRENCIES } from "@/lib/currency";
import { DebtRow } from "./debt-row";
import type { ProviderBalance, ProviderLedgerRow } from "@/lib/providers";

type ProviderWithLedger = ProviderBalance & { ledger: ProviderLedgerRow[] };

/** "Le debemos $X" / "A favor $X" por moneda con saldo — nada si está en cero. */
function BalanceLine({ balance }: { balance: ProviderBalance["balance"] }) {
  const entries = CURRENCIES.filter((c) => balance[c] !== 0);
  if (entries.length === 0) {
    return <span className="text-sm text-foreground/50">Sin saldo pendiente</span>;
  }
  return (
    <span className="flex flex-col items-end gap-0.5 text-sm font-semibold">
      {entries.map((c) => (
        <span key={c} className={balance[c] > 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-600"}>
          {balance[c] > 0 ? "Le debemos " : "A favor "}
          {formatMoney(Math.abs(balance[c]), c)}
        </span>
      ))}
    </span>
  );
}

/**
 * Cuenta corriente por proveedor: saldo acumulado (deudas − lo que ya le
 * llegó, ver `getProviderBalances`) más el historial completo que lo arma,
 * colapsado por defecto (mismo patrón que "Historial de notas"). Las deudas
 * son editables/borrables acá (`DebtRow`, sin Origen/Destino — el proveedor
 * queda fijo); los pagos que las saldan (Ingreso/Egreso) se muestran de solo
 * lectura, se editan desde la pestaña Movimientos. Solo admin (la página ya
 * filtra quién la recibe).
 */
export function ProvidersSection({ providers }: { providers: ProviderWithLedger[] }) {
  if (providers.length === 0) {
    return (
      <p className="rounded-lg border border-foreground/10 px-3 py-2 text-sm text-foreground/50">
        Todavía no hay proveedores configurados. Marcá un medio de pago ajeno como
        &quot;Proveedor&quot; en Configuración → Medios de pago para habilitar su cuenta corriente
        acá.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {providers.map((p) => (
        <section key={p.id} className="rounded-xl border border-foreground/10 p-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">{p.name}</h3>
            <BalanceLine balance={p.balance} />
          </div>
          {p.ledger.length === 0 ? (
            <p className="mt-2 text-xs text-foreground/50">Sin movimientos todavía.</p>
          ) : (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-medium text-foreground/60 hover:text-foreground/80">
                Movimientos ({p.ledger.length})
              </summary>
              <ul className="mt-2 flex flex-col gap-2">
                {p.ledger.map((m) =>
                  m.kind === "debt" ? (
                    <DebtRow key={`${m.id}:${m.description}:${m.amount}:${m.currency}`} movement={m} />
                  ) : (
                    <li key={m.id} className="rounded-lg border border-foreground/10 px-3 py-2 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 whitespace-pre-wrap">{m.description}</p>
                        <p className="shrink-0 font-semibold text-emerald-600">
                          −{formatMoney(m.amount, m.currency)}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-foreground/50">
                        {m.kind === "client_payment" ? "Pago directo del cliente" : "Pagado por la empresa"} ·{" "}
                        {m.createdByName} · {formatDateTime(m.createdAt)}
                      </p>
                    </li>
                  ),
                )}
              </ul>
            </details>
          )}
        </section>
      ))}
    </div>
  );
}
