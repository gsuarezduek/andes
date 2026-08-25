"use client";

import { useState } from "react";
import type { PaymentMethodOwnership } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { CashMovementForm } from "./cash-movement-form";
import type { RentalPickerOption } from "@/lib/cash";

type PaymentMethodOption = {
  id: string;
  name: string;
  requiresNote: boolean;
  ownership: PaymentMethodOwnership;
};
type Action = "income" | "expense" | null;

/**
 * Selector de qué movimiento cargar: Ingreso o Egreso, 50/50. La deuda con un
 * proveedor se carga desde su tarjeta en la pestaña Proveedores (ya sabe a
 * quién); la caja fuerte tiene su propio lanzador en su propia pestaña
 * (ver `SafeLauncher`) — ninguna de las dos vive acá.
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

  return (
    <div className="flex gap-3">
      <Button type="button" className="flex-1" onClick={() => setAction("income")}>
        + Ingreso
      </Button>
      <Button type="button" variant="secondary" className="flex-1" onClick={() => setAction("expense")}>
        + Egreso
      </Button>
    </div>
  );
}
