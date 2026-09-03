"use client";

import { useActionState, useEffect, useRef, useState, type ChangeEvent } from "react";
import { TextField, SelectField, FormError } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { ButtonLink } from "@/components/ui/button";
import { languageLabels } from "@/lib/labels";
import type { FormState } from "./actions/schemas";

type VehicleOption = { id: string; label: string };

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

const EMPTY_VALUES = {
  clientName: "",
  clientEmail: "",
  clientPhone: "",
  clientDocNumber: "",
  clientAddress: "",
  vehicleId: "",
  startAt: "",
  endAt: "",
  language: "es",
};

export function RentalForm({
  action,
  vehicles,
}: {
  action: Action;
  vehicles: VehicleOption[];
}) {
  const [state, formAction] = useActionState(action, {});
  const fieldErrors = state.fieldErrors ?? {};

  // Todos los campos van controlados: React 19 resetea los campos NO
  // controlados de un <form action> a su valor de montaje apenas termina
  // cada submit (mismo comportamiento nativo de un <form> sin JS, ver
  // requestFormReset) — sin esto, un rechazo (ej. choque de fechas con otra
  // reserva del mismo auto) borraba todo lo tipeado, incluidos campos
  // obligatorios como el nombre, y "Asignar igual" nunca llegaba a
  // reenviar el auto/fechas que el empleado realmente había elegido.
  const [values, setValues] = useState(EMPTY_VALUES);
  const setField =
    (key: keyof typeof values) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setValues((v) => ({ ...v, [key]: e.target.value }));

  // Mismo criterio que EditDetailsForm: si el auto elegido se rechaza (ya
  // reservado en esas fechas, etc.), traer el <select> a la vista además de
  // resaltarlo en rojo — puede quedar arriba, fuera de pantalla, al llegar
  // scrolleando hasta el botón "Crear alquiler".
  const vehicleFieldRef = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (fieldErrors.vehicleId) {
      vehicleFieldRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [fieldErrors.vehicleId]);
  // El reset nativo del <form action> corrige el <select> de vuelta a su
  // primera opción de forma ASINCRÓNICA, después de que React ya renderizó
  // `value={values.vehicleId}` correcto — el DOM queda corrompido igual sin
  // que React se entere. Se reafirma a mano apenas se resuelve cada submit
  // (mismo criterio que EditDetailsForm).
  useEffect(() => {
    if (vehicleFieldRef.current) vehicleFieldRef.current.value = values.vehicleId;
  }, [state, values.vehicleId]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <TextField
        id="clientName"
        label="Nombre del cliente"
        value={values.clientName}
        onChange={setField("clientName")}
        required
        error={fieldErrors.clientName}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="clientEmail"
          label="Email"
          type="email"
          value={values.clientEmail}
          onChange={setField("clientEmail")}
          hint="Opcional — para enviar el acta"
          error={fieldErrors.clientEmail}
        />
        <TextField
          id="clientPhone"
          label="Teléfono"
          value={values.clientPhone}
          onChange={setField("clientPhone")}
          hint="Opcional"
          error={fieldErrors.clientPhone}
        />
      </div>
      <TextField
        id="clientDocNumber"
        label="Nro. de documento"
        value={values.clientDocNumber}
        onChange={setField("clientDocNumber")}
        hint="Opcional"
        error={fieldErrors.clientDocNumber}
      />
      <TextField
        id="clientAddress"
        label="Domicilio en Mendoza"
        value={values.clientAddress}
        onChange={setField("clientAddress")}
        hint="Opcional"
        error={fieldErrors.clientAddress}
      />

      <SelectField
        ref={vehicleFieldRef}
        id="vehicleId"
        label="Vehículo"
        value={values.vehicleId}
        onChange={setField("vehicleId")}
        hint="Se puede asignar más tarde"
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
          mandar el mismo auto+fechas (mismo choque) esto salta la validación
          una sola vez; si cambia cualquiera de los tres, deja de coincidir y
          se revalida (ver overlapKey en actions/create.ts). */}
      <input type="hidden" name="confirmOverlapFor" value={state.overlapKey ?? ""} />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="startAt"
          label="Retiro"
          type="datetime-local"
          value={values.startAt}
          onChange={setField("startAt")}
          required
          error={fieldErrors.startAt}
        />
        <TextField
          id="endAt"
          label="Devolución"
          type="datetime-local"
          value={values.endAt}
          onChange={setField("endAt")}
          required
          error={fieldErrors.endAt}
        />
      </div>

      <SelectField
        id="language"
        label="Idioma del cliente"
        value={values.language}
        onChange={setField("language")}
        hint="Para el acta y los emails"
      >
        {Object.entries(languageLabels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </SelectField>

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

      <div className="flex gap-3">
        <SubmitButton>{state.overlapConfirm ? "Asignar igual" : "Crear alquiler"}</SubmitButton>
        <ButtonLink href="/rentals" variant="secondary">
          Cancelar
        </ButtonLink>
      </div>
    </form>
  );
}
