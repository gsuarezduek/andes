"use client";

import { useActionState } from "react";
import { TextField, FormError } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateReturnDetails } from "../actions/update-return";
import type { FormState } from "../actions/schemas";

/**
 * Modifica la fecha y el lugar de devolución desde el detalle del alquiler —
 * para cuando el cliente extiende el alquiler. Disponible mientras el alquiler
 * no esté finalizado ni cancelado.
 */
export function EditReturnForm({
  rentalId,
  endAt,
  returnPlace,
}: {
  rentalId: string;
  endAt: string; // "YYYY-MM-DDTHH:mm" en hora de Mendoza
  returnPlace: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(updateReturnDetails, {});

  return (
    <details className="rounded-xl border border-foreground/10">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground/70">
        Modificar devolución (extensión)
      </summary>
      <form action={formAction} className="flex flex-col gap-4 border-t border-foreground/10 p-4">
        <input type="hidden" name="rentalId" value={rentalId} />
        <TextField id="endAt" label="Fecha y hora de devolución" type="datetime-local" defaultValue={endAt} required />
        <TextField id="returnPlace" label="Lugar de devolución" defaultValue={returnPlace} placeholder="Ej. Aeropuerto, oficina centro…" />
        {state.ok && (
          <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
            Devolución actualizada.
          </p>
        )}
        <FormError>{state.error}</FormError>
        <SubmitButton pendingLabel="Guardando…">Guardar cambios</SubmitButton>
      </form>
    </details>
  );
}
