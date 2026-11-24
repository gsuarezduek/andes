"use client";

import { useActionState, useState } from "react";
import { TextField, SelectField, FormError } from "@/components/ui/fields";
import { OptionOrTextField } from "@/components/ui/option-or-text-field";
import { languageLabels } from "@/lib/labels";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateRentalSchedule } from "../actions/update-schedule";
import type { FormState } from "../actions/schemas";

/**
 * Corrige a mano la hora y el lugar de retiro/devolución — típico cuando el
 * dato llegó mal de VikRentCar, cambió después, o el cliente extiende el
 * alquiler. Reemplaza ir a cambiarlo en la web: a partir de guardar acá, el
 * sync deja de pisar lo tocado para esta reserva (ver `updateRentalSchedule`).
 *
 * Con `bookingInfo` (alquiler manual de un auto de tercero, que no pasa por
 * VikRentCar) es "Editar datos de pago y retiro": los lugares se eligen de la
 * lista de la web y además se corrigen el método de pago y el idioma.
 */
export function EditScheduleForm({
  rentalId,
  canEditPickup,
  startAt,
  pickupPlace,
  endAt,
  returnPlace,
  isActive,
  bookingInfo,
}: {
  rentalId: string;
  canEditPickup: boolean;
  startAt: string; // "YYYY-MM-DDTHH:mm" en hora de Mendoza
  pickupPlace: string;
  endAt: string;
  returnPlace: string;
  isActive: boolean;
  bookingInfo?: {
    paymentMethod: string;
    language: "es" | "en";
    placeOptions: string[];
    paymentOptions: string[];
  };
}) {
  const [state, formAction] = useActionState<FormState, FormData>(updateRentalSchedule, {});
  // Controlados: el reset nativo del <form action> los volvería al valor de
  // montaje después de guardar (ver RentalForm).
  const [pickup, setPickup] = useState(pickupPlace);
  const [ret, setRet] = useState(returnPlace);
  const [payment, setPayment] = useState(bookingInfo?.paymentMethod ?? "");
  const [language, setLanguage] = useState(bookingInfo?.language ?? "es");
  const placeHint = "Ej. Aeropuerto, oficina centro…";

  const pickupField = bookingInfo ? (
    <OptionOrTextField
      id="pickupPlace"
      label="Lugar de retiro"
      options={bookingInfo.placeOptions}
      value={pickup}
      onChange={setPickup}
      placeholder={placeHint}
    />
  ) : (
    <TextField id="pickupPlace" label="Lugar de retiro" defaultValue={pickupPlace} placeholder={placeHint} />
  );
  const returnField = bookingInfo ? (
    <OptionOrTextField
      id="returnPlace"
      label="Lugar de devolución"
      options={bookingInfo.placeOptions}
      value={ret}
      onChange={setRet}
      placeholder={placeHint}
    />
  ) : (
    <TextField id="returnPlace" label="Lugar de devolución" defaultValue={returnPlace} placeholder={placeHint} />
  );

  return (
    <details className="rounded-xl border border-foreground/10">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground/70">
        {bookingInfo
          ? "Editar datos de pago y retiro"
          : `Modificar hora/lugar de ${canEditPickup ? "retiro y devolución" : "devolución"}`}
      </summary>
      <form action={formAction} className="flex flex-col gap-4 border-t border-foreground/10 p-4">
        <input type="hidden" name="rentalId" value={rentalId} />
        <input type="hidden" name="confirmOverlapFor" value={state.overlapKey ?? ""} />

        {canEditPickup && (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id="startAt" label="Fecha y hora de retiro" type="datetime-local" defaultValue={startAt} required />
            {pickupField}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="endAt" label="Fecha y hora de devolución" type="datetime-local" defaultValue={endAt} required />
          {returnField}
        </div>

        {bookingInfo && (
          <div className="grid gap-4 sm:grid-cols-2">
            <OptionOrTextField
              id="bookingPaymentMethod"
              label="Método de pago"
              options={bookingInfo.paymentOptions}
              value={payment}
              onChange={setPayment}
            />
            <SelectField
              id="language"
              label="Idioma del cliente"
              value={language}
              onChange={(e) => setLanguage(e.target.value as "es" | "en")}
              hint="Para el acta y los emails"
            >
              {Object.entries(languageLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
          </div>
        )}

        {isActive && (
          <p className="text-xs text-foreground/50">
            Esto solo corrige el dato, sin cargo. Si el cliente extiende el alquiler y hay que cobrar, usá
            &quot;Extender alquiler&quot; (ícono de arriba).
          </p>
        )}

        {state.overlapConfirm ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
            <p>{state.error}</p>
            <p className="mt-1 text-xs">
              Si ya hablaste con el cliente actual y sabés que el auto va a estar libre a tiempo, podés guardar igual.
            </p>
          </div>
        ) : (
          <FormError>{state.error}</FormError>
        )}

        {state.ok && (
          <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
            {bookingInfo ? "Datos actualizados." : "Horario/lugar actualizado."}
          </p>
        )}

        <SubmitButton pendingLabel="Guardando…">{state.overlapConfirm ? "Guardar igual" : "Guardar cambios"}</SubmitButton>
      </form>
    </details>
  );
}
