"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset, type ForgotPasswordState } from "./actions";
import { TextField, FormError } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";

const initial: ForgotPasswordState = {};

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordReset, initial);

  if (state.ok) {
    return (
      <div className="flex flex-col gap-4 text-sm">
        <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-emerald-700 dark:text-emerald-400">
          Si el email está registrado, te enviamos un link para restablecer tu contraseña. Revisá tu casilla.
        </p>
        <Link href="/login" className="text-center text-foreground/60 underline underline-offset-2">
          Volver a ingresar
        </Link>
      </div>
    );
  }

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
      <FormError>{state.error}</FormError>
      <SubmitButton pendingLabel="Enviando…" className="w-full">
        Enviar link de recuperación
      </SubmitButton>
      <Link href="/login" className="text-center text-sm text-foreground/60 underline underline-offset-2">
        Volver a ingresar
      </Link>
    </form>
  );
}
