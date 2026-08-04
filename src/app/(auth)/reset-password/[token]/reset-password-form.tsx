"use client";

import { useActionState } from "react";
import { resetPassword, type ResetPasswordState } from "./actions";
import { TextField, FormError } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";

const initial: ResetPasswordState = {};

export function ResetPasswordForm({ token }: { token: string }) {
  const action = resetPassword.bind(null, token);
  const [state, formAction] = useActionState(action, initial);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <TextField
        id="password"
        label="Nueva contraseña"
        type="password"
        autoComplete="new-password"
        required
        autoFocus
      />
      <TextField
        id="confirm"
        label="Confirmar contraseña"
        type="password"
        autoComplete="new-password"
        required
      />
      <FormError>{state.error}</FormError>
      <SubmitButton pendingLabel="Guardando…" className="w-full">
        Guardar nueva contraseña
      </SubmitButton>
    </form>
  );
}
