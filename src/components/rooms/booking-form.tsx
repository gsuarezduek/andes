"use client";

import { useActionState, useState } from "react";
import { TextField, TextareaField, FormError } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { CurrencyToggle } from "@/components/cash/currency-toggle";
import type { Currency } from "@/lib/currency";
import type { FormState } from "@/app/(app)/rooms/actions";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

export type BookingFormValues = {
  startDate: string;
  endDate: string;
  guestName: string | null;
  notes: string | null;
  totalAmount: number;
  currency: Currency;
  isBlock: boolean;
};

/**
 * Alta / edición de una reserva. En una importada (`datesLocked`) las fechas
 * las manda el calendario de origen: solo se editan huésped, notas y total.
 */
export function BookingForm({
  action,
  booking,
  datesLocked = false,
  submitLabel,
  suggestedRate,
}: {
  action: Action;
  booking?: BookingFormValues;
  datesLocked?: boolean;
  submitLabel: string;
  /** Tarifa por noche de la habitación, para sugerir el total. */
  suggestedRate?: number | null;
}) {
  const [state, formAction] = useActionState(action, {});
  const [currency, setCurrency] = useState<Currency>(booking?.currency ?? "ars");
  const [start, setStart] = useState(booking?.startDate ?? "");
  const [end, setEnd] = useState(booking?.endDate ?? "");
  const [total, setTotal] = useState(booking && booking.totalAmount > 0 ? String(booking.totalAmount) : "");

  const nights =
    start && end && end > start ? Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) : 0;
  const suggested = suggestedRate && nights > 0 && currency === "ars" ? suggestedRate * nights : null;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          id="startDate"
          label="Entrada"
          type="date"
          required
          value={start}
          onChange={(e) => setStart(e.target.value)}
          readOnly={datesLocked}
          hint={datesLocked ? "Viene del calendario de origen." : undefined}
        />
        <TextField id="endDate" label="Salida" type="date" required value={end} onChange={(e) => setEnd(e.target.value)} readOnly={datesLocked} />
      </div>
      {nights > 0 ? <p className="-mt-1 text-xs text-foreground/50">{nights} noche{nights === 1 ? "" : "s"}</p> : null}
      <TextField id="guestName" label="Huésped" defaultValue={booking?.guestName ?? ""} hint="Opcional — el calendario de Airbnb/Booking casi nunca trae el nombre." />
      <div className="grid grid-cols-[7fr_3fr] gap-2">
        <TextField
          id="totalAmount"
          label="Total de la estadía"
          type="number"
          step="0.01"
          min="0"
          prefix="$"
          value={total}
          onChange={(e) => setTotal(e.target.value)}
        />
        <CurrencyToggle value={currency} onChange={setCurrency} />
      </div>
      {suggested != null && total !== String(suggested) ? (
        <button type="button" className="-mt-1 w-fit text-xs underline" onClick={() => setTotal(String(suggested))}>
          Usar {nights} noche{nights === 1 ? "" : "s"} × tarifa = ${suggested.toLocaleString("es-AR")}
        </button>
      ) : null}
      <TextareaField id="notes" label="Notas" rows={2} defaultValue={booking?.notes ?? ""} />
      {datesLocked ? null : (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isBlock" defaultChecked={booking?.isBlock} className="size-4" />
            Es un bloqueo (mantenimiento, uso propio…), no un huésped
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground/70">
            <input type="checkbox" name="allowOverlap" className="size-4" />
            Guardar igual aunque se superponga con otra reserva
          </label>
        </>
      )}
      <FormError>{state.error}</FormError>
      {state.ok ? <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">{state.ok}</p> : null}
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
