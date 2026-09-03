"use client";

import { useActionState, useRef, useEffect } from "react";
import { TextField, FormError } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { createGpsDevice, type FormState } from "./actions";

const initialState: FormState = {};

export function GpsDeviceForm() {
  const [state, formAction] = useActionState(createGpsDevice, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.error) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <TextField id="identifier" label="Identificador" required placeholder="Ej. N° de serie o IMEI" />
        </div>
        <SubmitButton pendingLabel="Agregando…">Agregar</SubmitButton>
      </div>
      <FormError>{state.error}</FormError>
    </form>
  );
}
