"use client";

import { useActionState, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField, TextareaField } from "@/components/ui/fields";
import { SectionHeading } from "@/components/ui/section-heading";
import { splitParagraphs, type ContractVersionFields } from "@/lib/contract-text";
import { saveContract, type SaveContractState } from "./actions";

/**
 * Editor de las condiciones generales. Campos controlados a propósito: React 19
 * resetea los campos no controlados de un `<form action>` tras cada envío, y
 * un error de validación no puede hacer perder un texto largo ya editado.
 */
export function ContractForm({
  initial,
  original,
}: {
  initial: ContractVersionFields;
  /** Texto original del sistema, para "Volver al texto original". */
  original: ContractVersionFields;
}) {
  const [values, setValues] = useState(initial);
  const [state, action] = useActionState<SaveContractState, FormData>(saveContract, {});
  const set = (k: keyof ContractVersionFields) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  return (
    <form action={action} className="flex flex-col gap-8">
      <LocaleBlock
        prefix="es"
        heading="Texto en español"
        title={values.esTitle}
        body={values.esBody}
        onTitle={set("esTitle")}
        onBody={set("esBody")}
      />
      <LocaleBlock
        prefix="en"
        heading="Texto en inglés"
        description="Se muestra en los alquileres marcados en inglés, y al cliente que cambie el idioma en la pantalla de firma."
        title={values.enTitle}
        body={values.enBody}
        onTitle={set("enTitle")}
        onBody={set("enBody")}
      />

      {state.error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm font-medium text-red-700 dark:text-red-400">{state.error}</p>
      )}
      {state.unchanged && (
        <p className="rounded-lg bg-foreground/5 px-3 py-2 text-sm text-foreground/70">
          No hubo cambios respecto del contrato vigente: no se guardó una versión nueva.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ButtonLink href="/settings" variant="secondary">Volver</ButtonLink>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="text-sm text-foreground/60 underline"
            onClick={() => setValues(original)}
          >
            Volver al texto original
          </button>
          <SubmitButton pendingLabel="Guardando…">Guardar contrato</SubmitButton>
        </div>
      </div>
    </form>
  );
}

function LocaleBlock({
  prefix,
  heading,
  description,
  title,
  body,
  onTitle,
  onBody,
}: {
  prefix: "es" | "en";
  heading: string;
  description?: string;
  title: string;
  body: string;
  onTitle: (e: { target: { value: string } }) => void;
  onBody: (e: { target: { value: string } }) => void;
}) {
  const clauses = splitParagraphs(body).length;
  return (
    <section className="flex flex-col gap-4">
      <SectionHeading description={description}>{heading}</SectionHeading>
      <TextField id={`${prefix}Title`} label="Título" value={title} onChange={onTitle} required />
      <TextareaField
        id={`${prefix}Body`}
        label="Cláusulas"
        hint={`Separá cada cláusula con una línea en blanco. La última se destaca en la pantalla de firma (es la de aceptación). ${clauses} ${clauses === 1 ? "cláusula" : "cláusulas"}.`}
        value={body}
        onChange={onBody}
        rows={18}
        className="leading-relaxed"
        required
      />
    </section>
  );
}
