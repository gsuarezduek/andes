"use client";

import { useActionState, useState } from "react";
import { FormError, TextField, TextareaField } from "@/components/ui/fields";
import { SavedBanner } from "@/components/ui/saved-banner";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { savePolicies, type ActionState } from "@/app/(app)/settings/whatsapp/bot/actions";

const initialState: ActionState = {};

type Policy = { topic: string; text: string };

export function PoliciesEditor({ policies: initial }: { policies: Policy[] }) {
  const [state, formAction] = useActionState(savePolicies, initialState);
  const [policies, setPolicies] = useState<Policy[]>(initial);
  const [topic, setTopic] = useState("");
  const [text, setText] = useState("");

  const add = () => {
    if (!topic.trim() || !text.trim()) return;
    setPolicies([...policies, { topic: topic.trim(), text: text.trim() }]);
    setTopic("");
    setText("");
  };

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <p className="text-sm text-foreground/60">
        Datos fijos del negocio, un tema por entrada (horarios, cruce a Chile, cancelación, conductores adicionales,
        etc.) — separado del prompt de personalidad para que puedas ir directo a actualizar uno sin releer todo. El
        bot los toma como la verdad, por encima de cualquier documento que los contradiga.
      </p>
      <FormError>{state.error}</FormError>
      <SavedBanner show={Boolean(state.ok)} label="Guardado." />
      <input type="hidden" name="policies" value={JSON.stringify(policies)} />

      <div className="flex flex-col gap-2 rounded-lg border border-foreground/10 p-3">
        <TextField
          id="new-topic"
          label="Tema"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Ej: Cruce a Chile"
        />
        <TextareaField
          id="new-text"
          label="Qué debe saber/responder el bot sobre esto"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
        />
        <Button type="button" variant="secondary" onClick={add} className="self-start">
          + Agregar tema
        </Button>
      </div>

      {policies.length > 0 ? (
        <ul className="flex flex-col divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
          {policies.map((p, i) => (
            <li key={`${p.topic}-${i}`} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{p.topic}</p>
                <p className="whitespace-pre-wrap text-foreground/60">{p.text}</p>
              </div>
              <button
                type="button"
                onClick={() => setPolicies(policies.filter((_, idx) => idx !== i))}
                className="shrink-0 text-xs text-foreground/40 hover:text-red-600"
              >
                Sacar
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-foreground/50">Todavía no hay temas cargados.</p>
      )}

      <div className="flex justify-end">
        <SubmitButton pendingLabel="Guardando…">Guardar</SubmitButton>
      </div>
    </form>
  );
}
