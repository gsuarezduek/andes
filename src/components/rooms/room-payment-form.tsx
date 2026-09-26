"use client";

import { useActionState, useState } from "react";
import { TextField, FormError } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { CurrencyToggle } from "@/components/cash/currency-toggle";
import { PaymentMethodPicker, type PaymentMethodPickerOption } from "@/components/cash/payment-method-picker";
import type { Currency } from "@/lib/currency";
import { addRoomPayment, type FormState } from "@/app/(app)/rooms/actions";

type Method = PaymentMethodPickerOption & { requiresNote: boolean };

/** Registra un cobro de la estadía → ingreso de Caja vinculado a la reserva. */
export function RoomPaymentForm({
  bookingId,
  paymentMethods,
  defaultCurrency,
}: {
  bookingId: string;
  paymentMethods: Method[];
  defaultCurrency: Currency;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(addRoomPayment.bind(null, bookingId), {});
  const [methodId, setMethodId] = useState("");
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);
  const method = paymentMethods.find((m) => m.id === methodId);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-4">
      <h3 className="text-sm font-semibold">Registrar un cobro</h3>
      <div className="grid grid-cols-[7fr_3fr] gap-2">
        <TextField id="amount" label="Monto" type="number" step="0.01" min="0" prefix="$" required />
        <CurrencyToggle value={currency} onChange={setCurrency} />
      </div>
      <PaymentMethodPicker
        id="paymentMethodId"
        label="Medio de pago"
        hint="Efectivo si lo cobraron en mano; o la cuenta a la que Airbnb/Booking acredita el pago."
        options={paymentMethods}
        value={methodId}
        onChange={setMethodId}
      />
      {method?.requiresNote ? <TextField id="paymentMethodNote" label="¿A dónde fue?" required hint="Obligatorio para este medio de pago" /> : null}
      <TextField id="detail" label="Detalle" hint="Opcional — ej. «seña», «saldo al llegar»." />
      <FormError>{state.error}</FormError>
      {state.ok ? <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">{state.ok}</p> : null}
      <SubmitButton pendingLabel="Registrando…" disabled={!methodId}>
        Registrar cobro
      </SubmitButton>
    </form>
  );
}
