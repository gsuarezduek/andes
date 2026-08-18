"use client";

import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { toggleWpPaymentMethodMapping } from "@/app/(app)/settings/payment-methods/actions";

export type WpPaymentMethodRow = {
  id: string;
  name: string;
  linkedIds: string[];
};

/**
 * Nombres de método de pago vistos en VikRentCar (se completan solos, ver
 * `upsertWpPaymentMethodCatalog` en el sync) con checkboxes para asociarlos a
 * uno o más medios de pago de Andes. Toggle instantáneo por checkbox (mismo
 * criterio que activar/desactivar un medio de pago) — no hay tantos nombres
 * distintos como para justificar un editor por lote.
 */
export function WpPaymentMethodsEditor({
  items,
  paymentMethods,
}: {
  items: WpPaymentMethodRow[];
  paymentMethods: { id: string; name: string }[];
}) {
  const [pending, start] = useTransition();

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-foreground/10 px-3 py-2 text-sm text-foreground/50">
        Todavía no se sincronizó ninguna reserva con un método de pago identificado.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((wp) => (
        <li key={wp.id} className="rounded-lg border border-foreground/10 p-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{wp.name}</p>
            {wp.linkedIds.length === 0 && <Badge tone="amber">sin asociar</Badge>}
          </div>
          <div className="mt-2 flex flex-wrap gap-3">
            {paymentMethods.map((m) => (
              <label key={m.id} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  disabled={pending}
                  checked={wp.linkedIds.includes(m.id)}
                  onChange={(e) => start(() => toggleWpPaymentMethodMapping(wp.id, m.id, e.target.checked))}
                />
                {m.name}
              </label>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
