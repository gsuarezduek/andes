import { AssociateCard } from "./associate-card";
import type { AssociateBalance, AssociateLedgerRow } from "@/lib/associates";

type PaymentMethodOption = { id: string; name: string; requiresNote?: boolean };
type AssociateWithLedger = AssociateBalance & { ledger: AssociateLedgerRow[] };

/**
 * Vista en limpio por asociado: una `AssociateCard` por cada uno (total
 * entregado, alta de ingreso/egreso inline, historial del mes + "ver todos"
 * paginado — ver ese componente). Visible para cualquier rol, mismo criterio
 * que Proveedores.
 */
export function AssociatesSection({
  associates,
  paymentMethods,
}: {
  associates: AssociateWithLedger[];
  paymentMethods: PaymentMethodOption[];
}) {
  if (associates.length === 0) {
    return (
      <p className="rounded-lg border border-foreground/10 px-3 py-2 text-sm text-foreground/50">
        Todavía no hay asociados configurados. Marcá un medio de pago ajeno como
        &quot;Asociado&quot; en Configuración → Medios de pago para habilitar su resumen acá.
      </p>
    );
  }

  const now = new Date();
  return (
    <div className="flex flex-col gap-3">
      {associates.map((a) => (
        <AssociateCard key={a.id} associate={a} paymentMethods={paymentMethods} now={now} />
      ))}
    </div>
  );
}
