"use client";

import { useState } from "react";
import { DebtMovementForm } from "./debt-movement-form";
import { ProviderPaymentForm } from "./provider-payment-form";
import type { ProviderBalance } from "@/lib/providers";

type PaymentMethodOption = { id: string; name: string; requiresNote?: boolean };

/**
 * Botones "+ Pago"/"+ Deuda" + sus formularios (Destino/Proveedor ya vienen
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
  const [formOpen, setFormOpen] = useState<"none" | "payment" | "debt">("none");

  if (formOpen === "payment") {
    return (
      <ProviderPaymentForm
        onCancel={() => setFormOpen("none")}
        onSuccess={() => setFormOpen("none")}
        account={provider}
        destinoOptions={[{ id: provider.id, name: provider.name }, ...provider.subaccounts]}
        paymentMethods={paymentMethods}
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
    </div>
  );
}
