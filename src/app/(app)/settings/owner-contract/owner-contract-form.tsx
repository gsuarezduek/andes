"use client";

import { useActionState, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField, TextareaField } from "@/components/ui/fields";
import { saveOwnerContractText, type SaveOwnerContractTextState } from "./actions";

type Text = { title: string; body: string };

/** Campos controlados a propósito: un error de validación no puede hacer perder un texto largo. */
export function OwnerContractForm({ initial, original }: { initial: Text; original: Text }) {
  const [values, setValues] = useState<Text>({ title: initial.title, body: initial.body });
  const [state, action] = useActionState<SaveOwnerContractTextState, FormData>(saveOwnerContractText, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <TextField
        id="title"
        label="Nombre del contrato"
        hint='Se usa en la frase inicial: "convienen celebrar el presente…".'
        value={values.title}
        onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
        required
      />
      <TextareaField
        id="body"
        label="Cláusulas"
        hint='Separá cada bloque con una línea en blanco. Una línea en MAYÚSCULAS al inicio de un bloque es un título. Las líneas que empiezan con "- " son una lista.'
        rows={22}
        className="leading-relaxed"
        value={values.body}
        onChange={(e) => setValues((v) => ({ ...v, body: e.target.value }))}
        required
      />

      {state.error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm font-medium text-red-700 dark:text-red-400">{state.error}</p>
      )}
      {state.unchanged && (
        <p className="rounded-lg bg-foreground/5 px-3 py-2 text-sm text-foreground/70">
          No hubo cambios respecto del texto vigente: no se guardó una versión nueva.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ButtonLink href="/settings" variant="secondary">Volver</ButtonLink>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="text-sm text-foreground/60 underline"
            onClick={() => setValues({ title: original.title, body: original.body })}
          >
            Volver al texto original
          </button>
          <SubmitButton pendingLabel="Guardando…">Guardar contrato</SubmitButton>
        </div>
      </div>
    </form>
  );
}
