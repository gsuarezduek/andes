"use client";

import { useState } from "react";
import { TextareaField } from "@/components/ui/fields";
import { WordChipsInput } from "@/components/whatsapp-bot/word-chips-input";
import { AutosaveStatus } from "@/components/whatsapp-bot/autosave-status";
import { useAutosave } from "@/components/whatsapp-bot/use-autosave";
import { useDebouncedCallback } from "@/lib/client/use-debounced-callback";
import { updatePersonality } from "@/app/(app)/settings/whatsapp/bot/actions";

export function PersonalityForm({
  enabled: initialEnabled,
  onlyNewConversations: initialOnlyNewConversations,
  trainingPhones: initialTrainingPhones,
  prompt: initialPrompt,
}: {
  enabled: boolean;
  onlyNewConversations: boolean;
  trainingPhones: string[];
  prompt: string;
}) {
  const { pending, saved, run } = useAutosave();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [onlyNewConversations, setOnlyNewConversations] = useState(initialOnlyNewConversations);
  const [trainingPhones, setTrainingPhones] = useState(initialTrainingPhones);
  const [prompt, setPrompt] = useState(initialPrompt);

  const debouncedSavePrompt = useDebouncedCallback((value: string) => {
    run(() => updatePersonality({ prompt: value.trim() }));
  }, 800);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-foreground/40">Los cambios se guardan solos.</span>
        <AutosaveStatus pending={pending} saved={saved} />
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            run(() => updatePersonality({ enabled: e.target.checked }));
          }}
          className="h-4 w-4"
        />
        Bot activado
      </label>
      <p className="-mt-2 text-xs text-foreground/50">
        Con esto apagado, ningún mensaje entrante recibe respuesta automática — el resto del inbox sigue funcionando
        normal.
      </p>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={onlyNewConversations}
          onChange={(e) => {
            setOnlyNewConversations(e.target.checked);
            run(() => updatePersonality({ onlyNewConversations: e.target.checked }));
          }}
          className="h-4 w-4"
        />
        Dejar de responder apenas un humano contesta esa conversación
      </label>

      <WordChipsInput
        label="Teléfonos de entrenamiento (excepción a la regla de arriba)"
        hint="El bot sigue respondiendo en estos números aunque ya hayas escrito vos — ideal para probar el bot desde tu propio celular sin apagarlo para toda la cuenta. Formato con código de país, ej: 5492611234567."
        words={trainingPhones}
        onChange={(next) => {
          setTrainingPhones(next);
          run(() => updatePersonality({ trainingPhones: next }));
        }}
      />

      <TextareaField
        id="prompt"
        label="Personalidad e instrucciones"
        value={prompt}
        onChange={(e) => {
          setPrompt(e.target.value);
          debouncedSavePrompt(e.target.value);
        }}
        rows={10}
        hint='Cómo se presenta, tono, qué puede y no puede resolver. Ej: "Sos el asistente de MDZ Rent a Car. Respondé breve, en español, tono cordial. Solo das información general de reservas — nunca inventes precios ni confirmes cambios de fecha, para eso derivá a un humano."'
      />
    </div>
  );
}
