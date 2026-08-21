"use client";

import { useState } from "react";
import { ConfirmPaymentMethodForm, type ConfirmablePaymentMethod } from "@/components/cash/confirm-payment-method-form";

/** Versión in-place del confirmar de Caja, para no tener que salir de la reserva. */
export function ConfirmPaymentInline({
  movementId,
  paymentMethods,
}: {
  movementId: string;
  paymentMethods: ConfirmablePaymentMethod[];
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-amber-700 underline dark:text-amber-400"
      >
        Confirmar medio de pago
      </button>
    );
  }

  return <ConfirmPaymentMethodForm movementId={movementId} paymentMethods={paymentMethods} onCancel={() => setOpen(false)} />;
}
