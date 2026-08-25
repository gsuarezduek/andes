import { ProviderCard } from "./provider-card";
import type { ProviderBalance, ProviderLedgerRow } from "@/lib/providers";

type PaymentMethodOption = { id: string; name: string; requiresNote?: boolean };
type ProviderWithLedger = ProviderBalance & { ledger: ProviderLedgerRow[] };

/**
 * Cuenta corriente por proveedor: una `ProviderCard` por cada uno (saldo,
 * alta de pago/deuda inline, historial del mes + "ver todos" paginado — ver
 * ese componente). Visible para cualquier rol; `isAdmin` solo gatea poder
 * editar/borrar una deuda ya cargada (`DebtRow`) — cargar pago/deuda nueva es
 * para cualquiera.
 */
export function ProvidersSection({
  providers,
  paymentMethods,
  isAdmin,
}: {
  providers: ProviderWithLedger[];
  paymentMethods: PaymentMethodOption[];
  isAdmin: boolean;
}) {
  if (providers.length === 0) {
    return (
      <p className="rounded-lg border border-foreground/10 px-3 py-2 text-sm text-foreground/50">
        Todavía no hay proveedores configurados. Marcá un medio de pago ajeno como
        &quot;Proveedor&quot; en Configuración → Medios de pago para habilitar su cuenta corriente
        acá.
      </p>
    );
  }

  const now = new Date();
  return (
    <div className="flex flex-col gap-3">
      {providers.map((p) => (
        <ProviderCard key={p.id} provider={p} paymentMethods={paymentMethods} now={now} isAdmin={isAdmin} />
      ))}
    </div>
  );
}
