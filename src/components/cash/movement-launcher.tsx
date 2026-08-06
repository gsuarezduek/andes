"use client";

import { useState } from "react";
import type { PaymentMethodOwnership } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { CashMovementForm } from "./cash-movement-form";
import { SafeMovementForm } from "./safe-movement-form";
import type { RentalPickerOption } from "@/lib/cash";

type PaymentMethodOption = { id: string; name: string; requiresNote: boolean; ownership: PaymentMethodOwnership };
type Action = "income" | "expense" | "safe" | null;

/**
 * Selector de qué movimiento cargar. Desktop: Cobro y Pago ocupan 40% del
 * ancho cada uno, Caja fuerte el 20% restante. Mobile: Cobro/Pago en una
 * fila (50/50) y Caja fuerte ocupa el ancho completo debajo — se acomoda
 * mejor que forzar la misma proporción angosta en una pantalla chica.
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

  return (
    <div className="grid grid-cols-2 gap-3 md:flex">
      <Button type="button" className="md:basis-[40%] md:flex-none" onClick={() => setAction("income")}>
        + Cobro
      </Button>
      <Button
        type="button"
        variant="secondary"
        className="md:basis-[40%] md:flex-none"
        onClick={() => setAction("expense")}
      >
        + Pago
      </Button>
      <Button
        type="button"
        variant="secondary"
        className="col-span-2 md:col-span-1 md:basis-[20%] md:flex-none"
        onClick={() => setAction("safe")}
      >
        Caja fuerte
      </Button>
    </div>
  );
}
