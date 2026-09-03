"use client";

import { useActionState, useEffect, useRef } from "react";
import { TextField, SelectField, FormError } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateRentalDetails } from "../actions/update-details";
import type { FormState } from "../actions/schemas";

type VehicleOption = { id: string; label: string };

/**
 * Edición rápida (antes de la entrega) de los datos de contacto del cliente y
 * el vehículo asignado, directamente en el detalle del alquiler. Al guardar,
 * el wizard de entrega ya no vuelve a pedir estos datos.
 */
export function EditDetailsForm({
  rentalId,
  clientName,
  clientEmail,
  clientPhone,
  clientDocNumber,
  clientAddress,
  vehicleId,
  vehicles,
}: {
  rentalId: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientDocNumber: string;
  clientAddress: string;
  vehicleId: string;
  vehicles: VehicleOption[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(updateRentalDetails, {});
  const fieldErrors = state.fieldErrors ?? {};

  // Si el guardado se rechaza por el auto elegido (archivado, ya reservado en
  // esas fechas, etc.), el <select> ya se resalta en rojo con el motivo — pero
  // en una pantalla chica podía quedar arriba, fuera de vista, si el empleado
  // scrolleó para llegar al botón "Guardar". Esto lo trae de vuelta a la vista.
  const vehicleFieldRef = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (fieldErrors.vehicleId) {
      vehicleFieldRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [fieldErrors.vehicleId]);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-xl border border-foreground/10 p-4">
      <p className="text-sm font-medium text-foreground/80">Datos del cliente y vehículo</p>
      <input type="hidden" name="rentalId" value={rentalId} />
      <TextField id="clientName" label="Nombre y apellido" defaultValue={clientName} required error={fieldErrors.clientName} />
      <div className="grid grid-cols-2 gap-3">
        <TextField id="clientDocNumber" label="Documento" defaultValue={clientDocNumber} error={fieldErrors.clientDocNumber} />
        <TextField id="clientPhone" label="Teléfono" type="tel" defaultValue={clientPhone} error={fieldErrors.clientPhone} />
      </div>
      <TextField
        id="clientEmail"
        label="Email"
        type="email"
        defaultValue={clientEmail}
        hint="Ahí llega el acta firmada."
        error={fieldErrors.clientEmail}
      />
      <TextField id="clientAddress" label="Domicilio en Mendoza" defaultValue={clientAddress} error={fieldErrors.clientAddress} />
      <SelectField
        ref={vehicleFieldRef}
        id="vehicleId"
        label="Vehículo"
        defaultValue={vehicleId}
        hint="Se puede asignar o cambiar antes de la entrega."
        error={fieldErrors.vehicleId}
      >
        <option value="">Sin asignar</option>
        {vehicles.map((v) => (
          <option key={v.id} value={v.id}>
            {v.label}
          </option>
        ))}
      </SelectField>

      <FormError>{state.error}</FormError>
      {state.ok && (
        <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Datos guardados.
        </p>
      )}

      <div className="flex gap-3">
        <SubmitButton variant="secondary">Guardar datos</SubmitButton>
        <SubmitButton name="intent" value="startHandover" pendingLabel="Guardando…" className="flex-1">
          Guardar e iniciar entrega
        </SubmitButton>
      </div>
    </form>
  );
}
