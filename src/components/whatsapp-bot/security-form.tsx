"use client";

import { useState } from "react";
import { TextareaField } from "@/components/ui/fields";
import { WordChipsInput } from "@/components/whatsapp-bot/word-chips-input";
import { AutosaveStatus } from "@/components/whatsapp-bot/autosave-status";
import { useAutosave } from "@/components/whatsapp-bot/use-autosave";
import { useDebouncedCallback } from "@/components/whatsapp-bot/use-debounced-callback";
import { updateSecurity } from "@/app/(app)/settings/whatsapp/bot/actions";

export function SecurityForm({
  blockedWords: initialBlocked,
  escalationWords: initialEscalation,
  handoffMessage: initialHandoffMessage,
}: {
  blockedWords: string[];
  escalationWords: string[];
  handoffMessage: string | null;
}) {
  const { pending, saved, run } = useAutosave();
  const [blockedWords, setBlockedWords] = useState(initialBlocked);
  const [escalationWords, setEscalationWords] = useState(initialEscalation);
  const [handoffMessage, setHandoffMessage] = useState(initialHandoffMessage ?? "");

  const debouncedSaveHandoff = useDebouncedCallback((value: string) => {
    run(() => updateSecurity({ handoffMessage: value.trim() || null }));
  }, 800);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-foreground/40">Los cambios se guardan solos.</span>
        <AutosaveStatus pending={pending} saved={saved} />
      </div>

      <WordChipsInput
        label="Palabras/temas bloqueados"
        hint="El bot nunca los menciona en su respuesta. Si aparecen igual, reintenta una vez y si persiste, deriva a un humano."
        words={blockedWords}
        onChange={(next) => {
          setBlockedWords(next);
          run(() => updateSecurity({ blockedWords: next }));
        }}
      />
      <WordChipsInput
        label="Palabras que derivan directo a un humano"
        hint='Si el cliente las menciona (ej. "cancelar", "reclamo", "hablar con una persona"), el bot deriva sin intentar responder.'
        words={escalationWords}
        onChange={(next) => {
          setEscalationWords(next);
          run(() => updateSecurity({ escalationWords: next }));
        }}
      />
      <TextareaField
        id="handoffMessage"
        label="Mensaje al derivar"
        value={handoffMessage}
        onChange={(e) => {
          setHandoffMessage(e.target.value);
          debouncedSaveHandoff(e.target.value);
        }}
        rows={3}
        hint="Lo que recibe el cliente cuando el bot deja la conversación en manos de una persona. Vacío usa un mensaje genérico."
      />
    </div>
  );
}
