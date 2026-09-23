import { ProviderCard } from "./provider-card";
import type { ProviderBalance } from "@/lib/providers";

type PaymentMethodOption = { id: string; name: string; requiresNote?: boolean };

/**
 * Cuenta corriente por proveedor: una `ProviderCard` por cada uno (saldo +
 * alta de pago/deuda inline) que linkea a `/caja/proveedores/[id]` para ver
 * el historial completo — ya no se expande inline, ver `ProviderCard`.
 * Visible para cualquier rol.
 */
export function ProvidersSection({
  providers,
  paymentMethods,
}: {
  providers: ProviderBalance[];
  paymentMethods: PaymentMethodOption[];
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

  return (
    <div className="flex flex-col gap-3">
      {providers.map((p) => (
        <ProviderCard key={p.id} provider={p} paymentMethods={paymentMethods} />
      ))}
    </div>
  );
}
