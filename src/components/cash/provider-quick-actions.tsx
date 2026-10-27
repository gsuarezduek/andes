"use client";

import { useState } from "react";
import { DebtMovementForm } from "./debt-movement-form";
import { OffsetMovementForm, type OffsetAccountOption } from "./offset-movement-form";
import { ProviderPaymentForm } from "./provider-payment-form";
import type { ProviderBalance } from "@/lib/providers";

type PaymentMethodOption = { id: string; name: string; requiresNote?: boolean } & OffsetAccountOption;

/**
 * Botones "+ Pago"/"+ Deuda"/"Compensar" + sus formularios (Destino/Proveedor ya vienen
 * fijos) — compartido entre `ProviderCard` (lista) y la página individual
 * (`/caja/proveedores/[id]`), para no duplicar el toggle de qué form mostrar.
 */
export function ProviderQuickActions({
  provider,
  paymentMethods,
}: {
  provider: ProviderBalance;
  paymentMethods: PaymentMethodOption[];
}) {
  const [formOpen, setFormOpen] = useState<"none" | "payment" | "debt" | "offset">("none");

  if (formOpen === "payment") {
    return (
      <ProviderPaymentForm
        onCancel={() => setFormOpen("none")}
        onSuccess={() => setFormOpen("none")}
        account={provider}
        destinoOptions={[
          { id: provider.id, name: provider.name, requiresNote: provider.requiresNote },
          ...provider.subaccounts.map((s) => ({ ...s, parentId: provider.id })),
        ]}
        paymentMethods={paymentMethods}
      />
    );
  }
  if (formOpen === "offset") {
    return (
      <OffsetMovementForm
        onCancel={() => setFormOpen("none")}
        onSuccess={() => setFormOpen("none")}
        account={provider}
        accounts={paymentMethods}
      />
    );
  }
  if (formOpen === "debt") {
    return (
      <DebtMovementForm onCancel={() => setFormOpen("none")} onSuccess={() => setFormOpen("none")} account={provider} />
    );
  }
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => setFormOpen("payment")}
        className="flex-1 rounded-lg border border-foreground/15 px-2 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:bg-foreground/5"
      >
        + Pago
      </button>
      <button
        type="button"
        onClick={() => setFormOpen("debt")}
        className="flex-1 rounded-lg border border-foreground/15 px-2 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:bg-foreground/5"
      >
        + Deuda
      </button>
      <button
        type="button"
        onClick={() => setFormOpen("offset")}
        title="Pagarle a esta cuenta cargándole la deuda a otra, sin mover caja"
        className="flex-1 rounded-lg border border-foreground/15 px-2 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:bg-foreground/5"
      >
        Compensar
      </button>
    </div>
  );
}
