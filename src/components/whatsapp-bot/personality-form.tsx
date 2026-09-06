"use client";

import { useActionState } from "react";
import { FormError, TextareaField } from "@/components/ui/fields";
import { SavedBanner } from "@/components/ui/saved-banner";
import { SubmitButton } from "@/components/ui/submit-button";
import { savePersonality, type ActionState } from "@/app/(app)/settings/whatsapp/bot/actions";

const initialState: ActionState = {};

export function PersonalityForm({
  enabled,
  onlyNewConversations,
  prompt,
}: {
  enabled: boolean;
  onlyNewConversations: boolean;
  prompt: string;
}) {
  const [state, formAction] = useActionState(savePersonality, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormError>{state.error}</FormError>
      <SavedBanner show={Boolean(state.ok)} label="Guardado." />

      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="enabled" defaultChecked={enabled} className="h-4 w-4" />
        Bot activado
      </label>
      <p className="-mt-2 text-xs text-foreground/50">
        Con esto apagado, ningún mensaje entrante recibe respuesta automática — el resto del inbox sigue funcionando
        normal.
      </p>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="onlyNewConversations" defaultChecked={onlyNewConversations} className="h-4 w-4" />
        Dejar de responder apenas un humano contesta esa conversación
      </label>

      <TextareaField
        id="prompt"
        label="Personalidad e instrucciones"
        defaultValue={prompt}
        rows={10}
        hint='Cómo se presenta, tono, qué puede y no puede resolver. Ej: "Sos el asistente de MDZ Rent a Car. Respondé breve, en español, tono cordial. Solo das información general de reservas — nunca inventes precios ni confirmes cambios de fecha, para eso derivá a un humano."'
      />

      <div className="flex justify-end">
        <SubmitButton pendingLabel="Guardando…">Guardar</SubmitButton>
      </div>
    </form>
  );
}
