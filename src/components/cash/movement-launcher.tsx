"use client";

import { useState } from "react";
import type { PaymentMethodOwnership } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { CashMovementForm } from "./cash-movement-form";
import { SafeMovementForm } from "./safe-movement-form";
import { DebtMovementForm } from "./debt-movement-form";
import type { RentalPickerOption } from "@/lib/cash";

type PaymentMethodOption = {
  id: string;
  name: string;
  requiresNote: boolean;
  ownership: PaymentMethodOwnership;
};
type Action = "income" | "expense" | "safe" | "debt" | null;

/**
 * Selector de qué movimiento cargar. Desktop: Ingreso y Egreso ocupan 35%
 * del ancho cada uno, Deuda y Caja fuerte 15% cada una. Mobile: los cuatro en
 * grilla 2×2 — Ingreso/Egreso arriba, Deuda/Caja fuerte abajo.
 */
export function MovementLauncher({
  paymentMethods,
  rentalOptions,
}: {
  paymentMethods: PaymentMethodOption[];
  rentalOptions: RentalPickerOption[];
}) {
  const [action, setAction] = useState<Action>(null);

  if (action === "income" || action === "expense") {
    return (
      <CashMovementForm
        mode={action}
        onCancel={() => setAction(null)}
        paymentMethods={paymentMethods}
        rentalOptions={rentalOptions}
      />
    );
  }

  if (action === "safe") {
    return <SafeMovementForm onCancel={() => setAction(null)} />;
  }

  if (action === "debt") {
    return (
      <DebtMovementForm
        onCancel={() => setAction(null)}
        providers={paymentMethods.filter((m) => m.ownership === "provider")}
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:flex">
      <Button type="button" className="md:basis-[35%] md:flex-none" onClick={() => setAction("income")}>
        + Ingreso
      </Button>
      <Button
        type="button"
        variant="secondary"
        className="md:basis-[35%] md:flex-none"
        onClick={() => setAction("expense")}
      >
        + Egreso
      </Button>
      <Button
        type="button"
        variant="secondary"
        className="md:basis-[15%] md:flex-none"
        onClick={() => setAction("debt")}
      >
        + Deuda
      </Button>
      <Button
        type="button"
        variant="secondary"
        className="md:basis-[15%] md:flex-none"
        onClick={() => setAction("safe")}
      >
        Caja fuerte
      </Button>
    </div>
  );
}
