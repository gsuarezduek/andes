"use client";

import { useState } from "react";
import { SectionTitle } from "@/components/ui/section-title";
import { LedgerRow } from "./ledger-row";
import { CurrencyTotalsDisplay } from "./currency-totals-display";
import { sumByCurrency } from "@/lib/currency";
import type { ThirdPartyLedgerRow } from "@/lib/third-party-accounts";
import type { ProviderLedgerMonthGroup } from "@/lib/provider-ledger-grouping";

const PAGE_SIZE_MONTHS = 6;

type PaymentMethodOption = { id: string; name: string; requiresNote?: boolean };

/**
 * Historial de una cuenta ajena (proveedor o asociado, `/caja/proveedores/
 * [id]` y `/caja/asociados/[id]`), partido por mes calendario — mismo patrón
 * que `AccountLedgerMonths` (Saldos): cada mes es un `<details>` colapsable
 * (el mes actual abierto de entrada), con "Deuda" a la izquierda y "Pagos"
 * (los dos tipos que la saldan) a la derecha, mismo criterio visual que
 * Movimientos/Saldos aunque acá no sea literalmente ingreso/egreso.
 */
export function ThirdPartyLedgerMonths({
  groups,
  currentMonthKey,
  principalName,
  isAdmin,
  paymentMethods,
  accountOptions,
}: {
  groups: ProviderLedgerMonthGroup<ThirdPartyLedgerRow>[];
  currentMonthKey: string;
  principalName: string;
  isAdmin: boolean;
  paymentMethods: PaymentMethodOption[];
  accountOptions: { id: string; name: string }[];
}) {
  const [visibleMonths, setVisibleMonths] = useState(PAGE_SIZE_MONTHS);

  if (groups.length === 0) {
    return (
      <p className="rounded-lg border border-foreground/10 px-3 py-2 text-sm text-foreground/50">
        Sin movimientos todavía.
      </p>
    );
  }

  const visible = groups.slice(0, visibleMonths);

  return (
    <div className="flex flex-col gap-6">
      {visible.map((g) => {
        const debts = g.rows.filter((r) => r.kind === "debt");
        const payments = g.rows.filter((r) => r.kind !== "debt");
        const debtTotals = sumByCurrency(debts);
        const paymentTotals = sumByCurrency(payments);
        const net = { ars: debtTotals.ars - paymentTotals.ars, usd: debtTotals.usd - paymentTotals.usd };
        return (
          <details
            key={g.key}
            open={g.key === currentMonthKey}
            className="rounded-xl border border-foreground/10 p-4"
          >
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
              <h3 className="text-base font-semibold">{g.label}</h3>
              <div className="text-right">
                <p className="text-xs text-foreground/50">Neto del mes</p>
                <CurrencyTotalsDisplay totals={net} size="text-base" />
              </div>
            </summary>
            <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <SectionTitle>Deuda ({debts.length})</SectionTitle>
                {debts.length === 0 ? (
                  <p className="rounded-lg border border-foreground/10 px-3 py-2 text-sm text-foreground/50">
                    Sin deuda cargada este mes.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {debts.map((m) => (
                      <LedgerRow
                        key={`${m.id}:${m.description}:${m.amount}:${m.currency}:${m.kind}:${m.originId}:${m.accountId}`}
                        movement={m}
                        isAdmin={isAdmin}
                        principalName={principalName}
                        paymentMethods={paymentMethods}
                        accountOptions={accountOptions}
                      />
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <SectionTitle>Pagos ({payments.length})</SectionTitle>
                {payments.length === 0 ? (
                  <p className="rounded-lg border border-foreground/10 px-3 py-2 text-sm text-foreground/50">
                    Sin pagos este mes.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {payments.map((m) => (
                      <LedgerRow
                        key={`${m.id}:${m.description}:${m.amount}:${m.currency}:${m.kind}:${m.originId}:${m.accountId}`}
                        movement={m}
                        isAdmin={isAdmin}
                        principalName={principalName}
                        paymentMethods={paymentMethods}
                        accountOptions={accountOptions}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </details>
        );
      })}
      {visibleMonths < groups.length && (
        <button
          type="button"
          onClick={() => setVisibleMonths((n) => n + PAGE_SIZE_MONTHS)}
          className="self-center rounded-lg border border-foreground/15 px-3 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:bg-foreground/5"
        >
          Ver meses anteriores ({groups.length - visibleMonths} restantes)
        </button>
      )}
    </div>
  );
}
