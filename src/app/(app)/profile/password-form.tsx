"use client";

import { useActionState } from "react";
import { TextField, FormError } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { changePassword } from "./actions";

export function PasswordForm() {
  const [state, formAction] = useActionState(changePassword, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormError>{state.error}</FormError>
      {state.ok ? (
        <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
          Contraseña actualizada.
        </p>
      ) : null}
      <TextField
        id="current"
        label="Contraseña actual"
        type="password"
        autoComplete="current-password"
        required
      />
      <TextField
        id="next"
        label="Nueva contraseña"
        type="password"
        autoComplete="new-password"
        required
        hint="Mínimo 6 caracteres"
      />
      <TextField
        id="confirm"
        label="Repetir nueva contraseña"
        type="password"
        autoComplete="new-password"
        required
      />
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Guardando…">Cambiar contraseña</SubmitButton>
      </div>
    </form>
  );
}
