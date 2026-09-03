"use client";

import { useActionState, useEffect, useRef, useState, type ChangeEvent } from "react";
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

  // Todos los campos van controlados: React 19 resetea los campos NO
  // controlados de un <form action> a su valor de montaje apenas termina
  // cada submit (mismo comportamiento nativo de un <form> sin JS, ver
  // requestFormReset) — sin esto, un rechazo (ej. choque de fechas) borraba
  // cualquier edición ya tipeada y, para el <select> de vehículo en
  // particular, volvía a mostrar (y a reenviar) el auto original aunque el
  // empleado hubiera elegido otro y tocara "Asignar igual" después del aviso.
  const [values, setValues] = useState({
    clientName,
    clientEmail,
    clientPhone,
    clientDocNumber,
    clientAddress,
    vehicleId,
  });
  const setField =
    (key: keyof typeof values) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setValues((v) => ({ ...v, [key]: e.target.value }));

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
  // El reset nativo del <form action> (ver más arriba) corrige el <select> de
  // vuelta a su patente original de forma ASINCRÓNICA, después de que React ya
  // renderizó `value={values.vehicleId}` correcto — controlarlo con `value` no
  // alcanza para un <select>, el DOM queda corrompido igual sin que React se
  // entere (no dispara otro render). Esto lo reafirma a mano apenas se resuelve
  // cada submit, después de que ese reset ya pudo haber corrido.
  useEffect(() => {
    if (vehicleFieldRef.current) vehicleFieldRef.current.value = values.vehicleId;
  }, [state, values.vehicleId]);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-xl border border-foreground/10 p-4">
      <p className="text-sm font-medium text-foreground/80">Datos del cliente y vehículo</p>
      <input type="hidden" name="rentalId" value={rentalId} />
      <TextField
        id="clientName"
        label="Nombre y apellido"
        value={values.clientName}
        onChange={setField("clientName")}
        required
        error={fieldErrors.clientName}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField
          id="clientDocNumber"
          label="Documento"
          value={values.clientDocNumber}
          onChange={setField("clientDocNumber")}
          error={fieldErrors.clientDocNumber}
        />
        <TextField
          id="clientPhone"
          label="Teléfono"
          type="tel"
          value={values.clientPhone}
          onChange={setField("clientPhone")}
          error={fieldErrors.clientPhone}
        />
      </div>
      <TextField
        id="clientEmail"
        label="Email"
        type="email"
        value={values.clientEmail}
        onChange={setField("clientEmail")}
        hint="Ahí llega el acta firmada."
        error={fieldErrors.clientEmail}
      />
      <TextField
        id="clientAddress"
        label="Domicilio en Mendoza"
        value={values.clientAddress}
        onChange={setField("clientAddress")}
        error={fieldErrors.clientAddress}
      />
      <SelectField
        ref={vehicleFieldRef}
        id="vehicleId"
        label="Vehículo"
        value={values.vehicleId}
        onChange={setField("vehicleId")}
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
      {/* Se reenvía tal cual — no es el empleado quien la arma. Si vuelve a
          elegir el mismo auto (mismo choque) esto salta la validación una
          sola vez; si cambia de auto, deja de coincidir y se revalida. */}
      <input type="hidden" name="confirmOverlapFor" value={state.overlapKey ?? ""} />

      {state.overlapConfirm ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          <p>{state.error}</p>
          <p className="mt-1 text-xs">
            Si ya hablaste con el cliente actual y sabés que el auto va a estar libre a tiempo, podés
            asignarlo igual.
          </p>
        </div>
      ) : (
        <FormError>{state.error}</FormError>
      )}
      {state.ok && (
        <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Datos guardados.
        </p>
      )}

      <div className="flex gap-3">
        <SubmitButton variant="secondary">{state.overlapConfirm ? "Asignar igual" : "Guardar datos"}</SubmitButton>
        <SubmitButton name="intent" value="startHandover" pendingLabel="Guardando…" className="flex-1">
          Guardar e iniciar entrega
        </SubmitButton>
      </div>
    </form>
  );
}
