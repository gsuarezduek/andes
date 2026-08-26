"use client";

import { useState } from "react";
import { AssociateCard } from "./associate-card";
import type { AssociateBalance, AssociateLedgerRow } from "@/lib/associates";

type PaymentMethodOption = { id: string; name: string; requiresNote?: boolean };
type AssociateWithLedger = AssociateBalance & { ledger: AssociateLedgerRow[] };

/**
 * Vista en limpio por asociado: una `AssociateCard` colapsada por defecto por
 * cada uno (saldo, alta de ingreso/egreso/deuda inline, historial completo —
 * ver ese componente), con un filtro arriba para ver uno en particular. Al
 * filtrar a uno solo, esa tarjeta se abre de entrada (no tiene sentido
 * mantenerla colapsada si es justo la que se estaba buscando). Visible para
 * cualquier rol, mismo criterio que Proveedores.
 */
export function AssociatesSection({
  associates,
  paymentMethods,
  isAdmin,
}: {
  associates: AssociateWithLedger[];
  paymentMethods: PaymentMethodOption[];
  isAdmin: boolean;
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

  const now = new Date();
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
        <AssociateCard
          key={a.id}
          associate={a}
          paymentMethods={paymentMethods}
          now={now}
          isAdmin={isAdmin}
          defaultOpen={a.id === filterId}
        />
      ))}
    </div>
  );
}
