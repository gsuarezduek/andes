import Link from "next/link";
import { ChevronRightIcon } from "@/components/ui/icons";
import { WhatsappAccountLink } from "./whatsapp-link";
import { BalanceLine } from "./balance-line";
import { AssociateQuickActions } from "./associate-quick-actions";
import type { AssociateBalance } from "@/lib/associates";

type PaymentMethodOption = { id: string; name: string; requiresNote?: boolean };

/**
 * Tarjeta de un asociado: nombre + saldo de cuenta corriente (mismo
 * mecanismo que `ProviderCard`, ver `src/lib/third-party-accounts.ts`), con
 * el encabezado clickeable hacia `/caja/asociados/[id]` (el historial
 * completo vive ahí — pedido del dueño, mismo criterio que Saldos y
 * Proveedores). Los botones de "+ Ingreso"/"+ Egreso"/"+ Deuda" siguen acá,
 * para cargar sin salir de la lista (ver `AssociateQuickActions`, compartido
 * con la página individual).
 */
export function AssociateCard({
  associate,
  paymentMethods,
}: {
  associate: AssociateBalance;
  paymentMethods: PaymentMethodOption[];
}) {
  return (
    <section className="rounded-xl border border-foreground/10 p-3">
      <Link
        href={`/caja/asociados/${associate.id}`}
        className="-m-1 flex items-center gap-3 rounded-lg p-1 transition-colors hover:bg-foreground/5"
      >
        <h3 className="min-w-0 flex-1 text-sm font-semibold">{associate.name}</h3>
        <BalanceLine balance={associate.balance} />
        <ChevronRightIcon className="size-4 shrink-0 text-foreground/30" />
      </Link>
      {associate.whatsappConversationId && (
        <div className="mt-1">
          <WhatsappAccountLink conversationId={associate.whatsappConversationId} />
        </div>
      )}
      {associate.subaccounts.length > 0 && (
        <p className="mt-1 text-xs text-foreground/50">
          Incluye {associate.subaccounts.length === 1 ? "su subcuenta" : "sus subcuentas"}:{" "}
          {associate.subaccounts.map((s) => s.name).join(", ")}.
        </p>
      )}

      <div className="mt-2">
        <AssociateQuickActions associate={associate} paymentMethods={paymentMethods} />
      </div>
    </section>
  );
}
