import Link from "next/link";
import { ChevronRightIcon } from "@/components/ui/icons";
import { WhatsappAccountLink } from "./whatsapp-link";
import { BalanceLine } from "./balance-line";
import { ProviderQuickActions } from "./provider-quick-actions";
import type { ProviderBalance } from "@/lib/providers";

type PaymentMethodOption = { id: string; name: string; requiresNote?: boolean };

/**
 * Tarjeta de un proveedor (cuenta corriente): nombre + saldo, con el
 * encabezado clickeable hacia `/caja/proveedores/[id]` (el historial
 * completo vive ahí, ya no se expande inline acá — pedido del dueño, mismo
 * criterio que Saldos: sin un link aparte de "Ver movimientos", toda la
 * tarjeta lleva). Los botones de "+ Pago"/"+ Deuda" siguen acá, para cargar
 * sin salir de la lista (ver `ProviderQuickActions`, compartido con la
 * página individual).
 */
export function ProviderCard({
  provider,
  paymentMethods,
}: {
  provider: ProviderBalance;
  paymentMethods: PaymentMethodOption[];
}) {
  return (
    <section className="rounded-xl border border-foreground/10 p-3">
      <Link
        href={`/caja/proveedores/${provider.id}`}
        className="-m-1 flex items-center gap-3 rounded-lg p-1 transition-colors hover:bg-foreground/5"
      >
        <h3 className="min-w-0 flex-1 text-sm font-semibold">{provider.name}</h3>
        <BalanceLine balance={provider.balance} />
        <ChevronRightIcon className="size-4 shrink-0 text-foreground/30" />
      </Link>
      {provider.whatsappConversationId && (
        <div className="mt-1">
          <WhatsappAccountLink conversationId={provider.whatsappConversationId} />
        </div>
      )}

      <div className="mt-2">
        <ProviderQuickActions provider={provider} paymentMethods={paymentMethods} />
      </div>
    </section>
  );
}
