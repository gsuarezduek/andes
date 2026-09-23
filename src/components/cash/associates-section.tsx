"use client";

import { useState } from "react";
import { AssociateCard } from "./associate-card";
import type { AssociateBalance } from "@/lib/associates";

type PaymentMethodOption = { id: string; name: string; requiresNote?: boolean };

/**
 * Vista en limpio por asociado: una `AssociateCard` por cada uno (saldo +
 * alta de ingreso/egreso/deuda inline) que linkea a `/caja/asociados/[id]`
 * para el historial completo — ya no se expande inline, ver `AssociateCard`.
 * El filtro arriba sigue sirviendo para encontrar uno entre varios. Visible
 * para cualquier rol, mismo criterio que Proveedores.
 */
export function AssociatesSection({
  associates,
  paymentMethods,
}: {
  associates: AssociateBalance[];
  paymentMethods: PaymentMethodOption[];
}) {
  const [filterId, setFilterId] = useState("");

  if (associates.length === 0) {
    return (
      <p className="rounded-lg border border-foreground/10 px-3 py-2 text-sm text-foreground/50">
        Todavía no hay asociados configurados. Marcá un medio de pago ajeno como
        &quot;Asociado&quot; en Configuración → Medios de pago para habilitar su resumen acá.
      </p>
    );
  }

  const visible = filterId ? associates.filter((a) => a.id === filterId) : associates;

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground/80">Asociado</span>
        <select
          value={filterId}
          onChange={(e) => setFilterId(e.target.value)}
          className="h-11 w-full max-w-xs rounded-lg border border-foreground/15 bg-transparent px-3 text-sm outline-none focus:border-foreground/40"
        >
          <option value="">Todos los asociados</option>
          {associates.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>

      {visible.map((a) => (
        <AssociateCard key={a.id} associate={a} paymentMethods={paymentMethods} />
      ))}
    </div>
  );
}
