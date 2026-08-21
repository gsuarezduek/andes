"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { TextField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { PaymentMethodPicker } from "@/components/cash/payment-method-picker";
import { confirmCashMovementPaymentMethod } from "@/app/(app)/caja/actions";

export type ConfirmablePaymentMethod = { id: string; name: string; requiresNote?: boolean };

/**
 * Formulario para completar el medio de pago real de un ingreso importado de
 * VikRentCar (`CashMovement.needsConfirmation`). Compartido entre Caja
 * (`UnconfirmedIncomesSection`) y el detalle de la reserva
 * (`PaymentHistorySection`) — misma server action, misma UI.
 */
export function ConfirmPaymentMethodForm({
  movementId,
  paymentMethods,
  onCancel,
  extraFooter,
}: {
  movementId: string;
  paymentMethods: ConfirmablePaymentMethod[];
  onCancel: () => void;
  extraFooter?: ReactNode;
}) {
  const [methodId, setMethodId] = useState("");
  const selected = paymentMethods.find((m) => m.id === methodId);

  return (
    <form action={confirmCashMovementPaymentMethod.bind(null, movementId)} className="mt-2 flex flex-col gap-2">
      <PaymentMethodPicker
        id="paymentMethodId"
        label="Medio de pago real"
        options={paymentMethods}
        value={methodId}
        onChange={setMethodId}
      />
      {selected?.requiresNote && (
        <TextField id="note" label="¿A dónde fue?" hint="Obligatorio para este medio de pago" required />
      )}
      <div className="flex items-center gap-3">
        <button type="button" onClick={onCancel} className="text-xs text-foreground/50">
          Cancelar
        </button>
        {extraFooter}
        <SubmitButton
          pendingLabel="Confirmando…"
          className="ml-auto h-auto px-2.5 py-1 text-xs"
          disabled={!methodId}
        >
          Confirmar
        </SubmitButton>
      </div>
    </form>
  );
}
