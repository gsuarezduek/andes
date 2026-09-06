"use client";

import { useActionState, useState } from "react";
import { FormError, TextareaField } from "@/components/ui/fields";
import { SavedBanner } from "@/components/ui/saved-banner";
import { SubmitButton } from "@/components/ui/submit-button";
import { WordChipsInput } from "@/components/whatsapp-bot/word-chips-input";
import { saveSecurity, type ActionState } from "@/app/(app)/settings/whatsapp/bot/actions";

const initialState: ActionState = {};

export function SecurityForm({
  blockedWords: initialBlocked,
  escalationWords: initialEscalation,
  handoffMessage,
}: {
  blockedWords: string[];
  escalationWords: string[];
  handoffMessage: string | null;
}) {
  const [state, formAction] = useActionState(saveSecurity, initialState);
  const [blockedWords, setBlockedWords] = useState(initialBlocked);
  const [escalationWords, setEscalationWords] = useState(initialEscalation);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <FormError>{state.error}</FormError>
      <SavedBanner show={Boolean(state.ok)} label="Guardado." />

      <input type="hidden" name="blockedWords" value={JSON.stringify(blockedWords)} />
      <input type="hidden" name="escalationWords" value={JSON.stringify(escalationWords)} />

      <WordChipsInput
        label="Palabras/temas bloqueados"
        hint="El bot nunca los menciona en su respuesta. Si aparecen igual, reintenta una vez y si persiste, deriva a un humano."
        words={blockedWords}
        onChange={setBlockedWords}
      />
      <WordChipsInput
        label="Palabras que derivan directo a un humano"
        hint='Si el cliente las menciona (ej. "cancelar", "reclamo", "hablar con una persona"), el bot deriva sin intentar responder.'
        words={escalationWords}
        onChange={setEscalationWords}
      />
      <TextareaField
        id="handoffMessage"
        label="Mensaje al derivar"
        defaultValue={handoffMessage ?? ""}
        rows={3}
        hint="Lo que recibe el cliente cuando el bot deja la conversación en manos de una persona. Vacío usa un mensaje genérico."
      />

      <div className="flex justify-end">
        <SubmitButton pendingLabel="Guardando…">Guardar</SubmitButton>
      </div>
    </form>
  );
}
