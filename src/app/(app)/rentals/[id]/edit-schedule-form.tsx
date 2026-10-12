"use client";

import { useActionState } from "react";
import { TextField, FormError } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateRentalSchedule } from "../actions/update-schedule";
import type { FormState } from "../actions/schemas";

/**
 * Corrige a mano la hora y el lugar de retiro/devolución — típico cuando el
 * dato llegó mal de VikRentCar, cambió después, o el cliente extiende el
 * alquiler. Reemplaza ir a cambiarlo en la web: a partir de guardar acá, el
 * sync deja de pisar lo tocado para esta reserva (ver `updateRentalSchedule`).
 */
export function EditScheduleForm({
  rentalId,
  canEditPickup,
  startAt,
  pickupPlace,
  endAt,
  returnPlace,
  isActive,
}: {
  rentalId: string;
  canEditPickup: boolean;
  startAt: string; // "YYYY-MM-DDTHH:mm" en hora de Mendoza
  pickupPlace: string;
  endAt: string;
  returnPlace: string;
  isActive: boolean;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(updateRentalSchedule, {});

  return (
    <details className="rounded-xl border border-foreground/10">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground/70">
        Modificar hora/lugar de {canEditPickup ? "retiro y devolución" : "devolución"}
      </summary>
      <form action={formAction} className="flex flex-col gap-4 border-t border-foreground/10 p-4">
        <input type="hidden" name="rentalId" value={rentalId} />
        <input type="hidden" name="confirmOverlapFor" value={state.overlapKey ?? ""} />

        {canEditPickup && (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id="startAt" label="Fecha y hora de retiro" type="datetime-local" defaultValue={startAt} required />
            <TextField id="pickupPlace" label="Lugar de retiro" defaultValue={pickupPlace} placeholder="Ej. Aeropuerto, oficina centro…" />
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="endAt" label="Fecha y hora de devolución" type="datetime-local" defaultValue={endAt} required />
          <TextField id="returnPlace" label="Lugar de devolución" defaultValue={returnPlace} placeholder="Ej. Aeropuerto, oficina centro…" />
        </div>

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
            Horario/lugar actualizado.
          </p>
        )}

        <SubmitButton pendingLabel="Guardando…">{state.overlapConfirm ? "Guardar igual" : "Guardar cambios"}</SubmitButton>
      </form>
    </details>
  );
}
