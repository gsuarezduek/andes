"use client";

import { useActionState, useState } from "react";
import { FormError, TextareaField } from "@/components/ui/fields";
import { SavedBanner } from "@/components/ui/saved-banner";
import { SubmitButton } from "@/components/ui/submit-button";
import { WordChipsInput } from "@/components/whatsapp-bot/word-chips-input";
import { savePersonality, type ActionState } from "@/app/(app)/settings/whatsapp/bot/actions";

const initialState: ActionState = {};

export function PersonalityForm({
  enabled,
  onlyNewConversations,
  trainingPhones: initialTrainingPhones,
  prompt,
}: {
  enabled: boolean;
  onlyNewConversations: boolean;
  trainingPhones: string[];
  prompt: string;
}) {
  const [state, formAction] = useActionState(savePersonality, initialState);
  const [trainingPhones, setTrainingPhones] = useState(initialTrainingPhones);

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

      <input type="hidden" name="trainingPhones" value={JSON.stringify(trainingPhones)} />
      <WordChipsInput
        label="Teléfonos de entrenamiento (excepción a la regla de arriba)"
        hint="El bot sigue respondiendo en estos números aunque ya hayas escrito vos — ideal para probar el bot desde tu propio celular sin apagarlo para toda la cuenta. Formato con código de país, ej: 5492611234567."
        words={trainingPhones}
        onChange={setTrainingPhones}
      />

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
