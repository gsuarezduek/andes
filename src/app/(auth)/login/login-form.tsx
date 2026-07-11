"use client";

import { useActionState } from "react";
import { authenticate, signInWithGoogle, type LoginState } from "./actions";
import { TextField, FormError } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { GoogleButton } from "./google-button";

const initial: LoginState = {};

export function LoginForm({
  error,
  googleEnabled = false,
}: {
  error?: string;
  googleEnabled?: boolean;
}) {
  const [state, formAction] = useActionState(authenticate, initial);

  return (
    <div className="flex flex-col gap-6">
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
        <FormError>{state.error ?? error}</FormError>
        <SubmitButton pendingLabel="Ingresando…" className="w-full">
          Ingresar
        </SubmitButton>
      </form>

      {googleEnabled && (
        <>
          <div className="flex items-center gap-3 text-xs text-foreground/40">
            <span className="h-px flex-1 bg-foreground/10" />
            <span>o</span>
            <span className="h-px flex-1 bg-foreground/10" />
          </div>

          <form action={signInWithGoogle}>
            <GoogleButton />
          </form>
        </>
      )}
    </div>
  );
}
