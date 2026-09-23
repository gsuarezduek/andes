"use client";

import { useState } from "react";
import { AssociateIncomeForm } from "./associate-income-form";
import { ProviderPaymentForm } from "./provider-payment-form";
import { DebtMovementForm } from "./debt-movement-form";
import type { AssociateBalance } from "@/lib/associates";

type PaymentMethodOption = { id: string; name: string; requiresNote?: boolean };

/**
 * Botones "+ Ingreso"/"+ Egreso"/"+ Deuda" + sus formularios (cuenta ya viene
 * fija) — compartido entre `AssociateCard` (lista) y la página individual
 * (`/caja/asociados/[id]`), para no duplicar el toggle de qué form mostrar.
 */
export function AssociateQuickActions({
  associate,
  paymentMethods,
}: {
  associate: AssociateBalance;
  paymentMethods: PaymentMethodOption[];
}) {
  const [formOpen, setFormOpen] = useState<"none" | "income" | "expense" | "debt">("none");
  const cuentaOptions = [{ id: associate.id, name: associate.name }, ...associate.subaccounts];

  if (formOpen === "income") {
    return (
      <AssociateIncomeForm
        onCancel={() => setFormOpen("none")}
        onSuccess={() => setFormOpen("none")}
        account={associate}
        cuentaOptions={cuentaOptions}
      />
    );
  }
  if (formOpen === "expense") {
    return (
      <ProviderPaymentForm
        onCancel={() => setFormOpen("none")}
        onSuccess={() => setFormOpen("none")}
        account={associate}
        destinoOptions={cuentaOptions}
        paymentMethods={paymentMethods}
      />
    );
  }
  if (formOpen === "debt") {
    return (
      <DebtMovementForm onCancel={() => setFormOpen("none")} onSuccess={() => setFormOpen("none")} account={associate} />
    );
  }
  return (
    <div className="grid grid-cols-3 gap-2">
      <button
        type="button"
        onClick={() => setFormOpen("income")}
        className="rounded-lg border border-foreground/15 px-2 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:bg-foreground/5"
      >
        + Ingreso
      </button>
      <button
        type="button"
        onClick={() => setFormOpen("expense")}
        className="rounded-lg border border-foreground/15 px-2 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:bg-foreground/5"
      >
        + Egreso
      </button>
      <button
        type="button"
        onClick={() => setFormOpen("debt")}
        className="rounded-lg border border-foreground/15 px-2 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:bg-foreground/5"
      >
        + Deuda
      </button>
    </div>
  );
}
