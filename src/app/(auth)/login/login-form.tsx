"use client";

import { useActionState } from "react";
import { authenticate, type LoginState } from "./actions";
import { TextField, FormError } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";

const initial: LoginState = {};

export function LoginForm() {
  const [state, formAction] = useActionState(authenticate, initial);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <TextField
        id="email"
        label="Email"
        type="email"
        autoComplete="username"
        required
        autoFocus
      />
      <TextField
        id="password"
        label="Contraseña"
        type="password"
        autoComplete="current-password"
        required
      />
      <FormError>{state.error}</FormError>
      <SubmitButton pendingLabel="Ingresando…" className="w-full">
        Ingresar
      </SubmitButton>
    </form>
  );
}
