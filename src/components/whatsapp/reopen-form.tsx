"use client";

import { useActionState } from "react";
import { FormError, SelectField, TextareaField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { reopenConversation, type MessageActionState } from "@/app/(app)/whatsapp/actions";

const initialState: MessageActionState = {};

type TemplateOption = { id: string; name: string; language: string; variableCount: number };

/**
 * Pasaron más de 24hs desde el último mensaje del cliente: la única forma de
 * retomar es con una plantilla aprobada. Las variables se cargan una por
 * línea, en el mismo orden que espera la plantilla.
 */
export function ReopenForm({ conversationId, templates }: { conversationId: string; templates: TemplateOption[] }) {
  const action = reopenConversation.bind(null, conversationId);
  const [state, formAction] = useActionState(action, initialState);

  if (templates.length === 0) {
    return (
      <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400">
        Pasaron más de 24hs desde el último mensaje del cliente. No hay plantillas aprobadas para retomar la
        conversación — sincronizalas desde Configuración → WhatsApp.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 border-t border-foreground/10 pt-3">
      <p className="text-sm text-foreground/60">
        Pasaron más de 24hs desde el último mensaje del cliente — retomá la conversación con una plantilla aprobada.
      </p>
      <FormError>{state.error}</FormError>
      <SelectField id="templateId" label="Plantilla" required defaultValue="">
        <option value="" disabled>
          Elegí una plantilla
        </option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} ({t.language}){t.variableCount > 0 ? ` — ${t.variableCount} variable(s)` : ""}
          </option>
        ))}
      </SelectField>
      <TextareaField
        id="variables"
        label="Variables"
        hint="Una por línea, en el mismo orden que la plantilla. Dejalo vacío si no tiene."
      />
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Enviando…">Retomar conversación</SubmitButton>
      </div>
    </form>
  );
}
