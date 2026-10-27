"use client";

import { useState } from "react";
import { AssociateIncomeForm } from "./associate-income-form";
import { ProviderPaymentForm } from "./provider-payment-form";
import { DebtMovementForm } from "./debt-movement-form";
import { OffsetMovementForm, type OffsetAccountOption } from "./offset-movement-form";
import type { AssociateBalance } from "@/lib/associates";

type PaymentMethodOption = { id: string; name: string; requiresNote?: boolean } & OffsetAccountOption;

/**
 * Botones "+ Ingreso"/"+ Egreso"/"+ Deuda"/"Compensar" + sus formularios (cuenta ya viene
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
  const [formOpen, setFormOpen] = useState<"none" | "income" | "expense" | "debt" | "offset">("none");
  const cuentaOptions = [
    { id: associate.id, name: associate.name, requiresNote: associate.requiresNote },
    ...associate.subaccounts.map((s) => ({ ...s, parentId: associate.id })),
  ];

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
  if (formOpen === "offset") {
    return (
      <OffsetMovementForm
        onCancel={() => setFormOpen("none")}
        onSuccess={() => setFormOpen("none")}
        account={associate}
        accounts={paymentMethods}
      />
    );
  }
  if (formOpen === "debt") {
    return (
      <DebtMovementForm onCancel={() => setFormOpen("none")} onSuccess={() => setFormOpen("none")} account={associate} />
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
      <button
        type="button"
        onClick={() => setFormOpen("offset")}
        title="Pagarle a esta cuenta cargándole la deuda a otra, sin mover caja"
        className="rounded-lg border border-foreground/15 px-2 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:bg-foreground/5"
      >
        Compensar
      </button>
    </div>
  );
}
