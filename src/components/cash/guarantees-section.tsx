import type { PaymentMethodOwnership } from "@prisma/client";
import { SectionTitle } from "@/components/ui/section-title";
import { GuaranteeCard } from "./guarantee-card";
import { MovementRow } from "./movement-row";
import { CurrencyTotalsDisplay } from "./currency-totals-display";
import { formatMoney } from "@/lib/contract";
import { formatDateTime } from "@/lib/datetime";
import type { Guarantees } from "@/lib/cash";

type PaymentMethodOption = { id: string; name: string; requiresNote?: boolean; ownership: PaymentMethodOwnership };
type ExpenseCategoryOption = { id: string; name: string };

/**
 * Garantías/depósitos (ver `RentalPayment.isGuarantee` en contract.ts): cada
 * una es una tarjeta con sus dos botones — "Devolver" (completa) o "Cobrar"
 * (total o parcial, el resto se devuelve en el mismo paso) — en vez de las
 * viejas columnas Tomadas/Devueltas: al resolverla sale de acá y pasa al
 * historial, colapsado por defecto (mismo patrón que "Historial de notas").
 */
export function GuaranteesSection({
  guarantees,
  paymentMethods,
  expenseCategories,
  isAdmin,
}: {
  guarantees: Guarantees;
  paymentMethods: PaymentMethodOption[];
  expenseCategories: ExpenseCategoryOption[];
  isAdmin: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-foreground/50">
        Se cargan desde &quot;Agregar pago&quot; (entrega, devolución o el detalle de una reserva) marcando &quot;Es
        una garantía&quot;, o desde Movimientos → +Ingreso con la misma casilla.
      </p>

      <div className="rounded-lg border border-foreground/10 p-3 text-center">
        <p className="text-xs text-foreground/50">En poder de la empresa hoy</p>
        <CurrencyTotalsDisplay totals={guarantees.activeTotal} />
      </div>

      <section className="flex flex-col gap-2">
        <SectionTitle>Activas ({guarantees.active.length})</SectionTitle>
        {guarantees.active.length === 0 ? (
          <p className="rounded-lg border border-foreground/10 px-3 py-2 text-sm text-foreground/50">
            Sin garantías activas.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {guarantees.active.map((g) => (
              <GuaranteeCard key={g.id} guarantee={g} paymentMethods={paymentMethods} isAdmin={isAdmin} />
            ))}
          </ul>
        )}
      </section>

      {guarantees.history.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs font-medium text-foreground/60">
            Historial ({guarantees.history.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-3">
            {guarantees.history.map((g) => (
              <li key={g.id} className="rounded-lg border border-foreground/10 p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 whitespace-pre-wrap">{g.description}</p>
                  <span className="shrink-0 font-semibold text-foreground">
                    {formatMoney(g.amount, g.currency)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-foreground/50">
                  {(g.guaranteeChargedAmount ?? 0) > 0 && `Cobrado: ${formatMoney(g.guaranteeChargedAmount, g.currency)}`}
                  {(g.guaranteeChargedAmount ?? 0) > 0 && (g.guaranteeReturnedAmount ?? 0) > 0 && " · "}
                  {(g.guaranteeReturnedAmount ?? 0) > 0 &&
                    `Devuelto: ${formatMoney(g.guaranteeReturnedAmount, g.currency)}`}
                </p>
                <p className="mt-0.5 text-xs text-foreground/50">
                  Resuelto por: {g.guaranteeResolvedByName ?? "—"} ·{" "}
                  {g.guaranteeResolvedAt ? formatDateTime(g.guaranteeResolvedAt) : "—"}
                </p>
                {g.derived.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-2 border-t border-foreground/10 pt-2">
                    {g.derived.map((d) => (
                      <MovementRow
                        key={`${d.id}:${d.description}:${d.amount}:${d.currency}`}
                        movement={d}
                        tone={d.type === "income" ? "emerald" : "red"}
                        paymentMethods={paymentMethods}
                        expenseCategories={expenseCategories}
                        canEdit={isAdmin}
                      />
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
