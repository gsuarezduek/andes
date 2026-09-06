"use client";

import { TextField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateCustomer } from "@/app/(app)/whatsapp/actions";

export function CustomerInfoForm({
  customerId,
  conversationId,
  name,
  email,
}: {
  customerId: string;
  conversationId: string;
  name: string | null;
  email: string | null;
}) {
  return (
    <form
      action={updateCustomer.bind(null, customerId, conversationId)}
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <TextField id="name" label="Nombre" defaultValue={name ?? ""} placeholder="Nombre del cliente" />
      <TextField id="email" label="Email" type="email" defaultValue={email ?? ""} placeholder="cliente@ejemplo.com" />
      <SubmitButton pendingLabel="Guardando…" variant="secondary" className="h-11">
        Guardar
      </SubmitButton>
    </form>
  );
}
