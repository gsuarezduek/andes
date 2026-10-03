"use client";

import { useActionState, useRef, useEffect } from "react";
import { TextField, TextareaField, FormError } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { PasswordField } from "@/components/access/password-field";
import { createAccessCredential, type FormState } from "@/app/(app)/access/actions";

const initialState: FormState = {};

export function AccessCredentialForm() {
  const [state, formAction] = useActionState(createAccessCredential, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.error) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-3">
      <TextField id="service" label="Sitio web o servicio" required placeholder="Ej. Railway, Resend, Hostinger" />
      <TextField id="username" label="Usuario" placeholder="Ej. email o nombre de usuario" />
      <PasswordField id="password" label="Contraseña" />
      <TextareaField id="extra" label="Extra" hint="Segundo factor, códigos de recuperación, o cualquier otro dato" rows={2} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="adminOnly" className="size-4 rounded border-foreground/30" />
        Solo un admin puede ver la contraseña y el extra
      </label>
      <FormError>{state.error}</FormError>
      <SubmitButton pendingLabel="Cargando…" className="self-start">
        Cargar nuevo acceso
      </SubmitButton>
    </form>
  );
}
