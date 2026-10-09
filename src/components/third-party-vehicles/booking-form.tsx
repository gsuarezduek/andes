"use client";

import { useActionState, useState } from "react";
import { TextField, TextareaField, FormError } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { CurrencyToggle } from "@/components/cash/currency-toggle";
import type { Currency } from "@/lib/currency";
import type { FormState } from "@/app/(app)/third-party-vehicles/actions";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

export type ThirdPartyBookingFormValues = {
  clientName: string;
  clientPhone: string | null;
  startAt: string;
  endAt: string;
  notes: string | null;
  totalAmount: number;
  currency: Currency;
};

export function ThirdPartyBookingForm({
  action,
  booking,
  submitLabel,
}: {
  action: Action;
  booking?: ThirdPartyBookingFormValues;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const [currency, setCurrency] = useState<Currency>(booking?.currency ?? "ars");
  const [total, setTotal] = useState(booking && booking.totalAmount > 0 ? String(booking.totalAmount) : "");

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField id="clientName" label="Cliente" required defaultValue={booking?.clientName ?? ""} maxLength={120} />
        <TextField id="clientPhone" label="Teléfono" defaultValue={booking?.clientPhone ?? ""} hint="Opcional" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField id="startAt" label="Retiro" type="datetime-local" required defaultValue={booking?.startAt ?? ""} />
        <TextField id="endAt" label="Devolución" type="datetime-local" required defaultValue={booking?.endAt ?? ""} />
      </div>
      <div className="grid grid-cols-[7fr_3fr] gap-2">
        <TextField
          id="totalAmount"
          label="Total de la reserva"
          type="number"
          step="0.01"
          min="0"
          prefix="$"
          value={total}
          onChange={(e) => setTotal(e.target.value)}
        />
        <CurrencyToggle value={currency} onChange={setCurrency} />
      </div>
      <TextareaField id="notes" label="Notas" rows={2} defaultValue={booking?.notes ?? ""} />
      <label className="flex items-center gap-2 text-sm text-foreground/70">
        <input type="checkbox" name="allowOverlap" className="size-4" />
        Guardar igual aunque se superponga con otra reserva de este auto
      </label>
      <FormError>{state.error}</FormError>
      {state.ok ? <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">{state.ok}</p> : null}
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
