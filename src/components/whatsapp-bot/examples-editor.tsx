"use client";

import { useActionState, useState } from "react";
import { FormError, TextField } from "@/components/ui/fields";
import { SavedBanner } from "@/components/ui/saved-banner";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { saveExamples, type ActionState } from "@/app/(app)/settings/whatsapp/bot/actions";

const initialState: ActionState = {};

type Example = { question: string; answer: string };

export function ExamplesEditor({ examples: initial }: { examples: Example[] }) {
  const [state, formAction] = useActionState(saveExamples, initialState);
  const [examples, setExamples] = useState<Example[]>(initial);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  const add = () => {
    if (!question.trim() || !answer.trim()) return;
    setExamples([...examples, { question: question.trim(), answer: answer.trim() }]);
    setQuestion("");
    setAnswer("");
  };

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <p className="text-sm text-foreground/60">
        Ejemplos de preguntas frecuentes y cómo responderlas — guían el tono, no son respuestas fijas para copiar
        literal.
      </p>
      <FormError>{state.error}</FormError>
      <SavedBanner show={Boolean(state.ok)} label="Guardado." />
      <input type="hidden" name="examples" value={JSON.stringify(examples)} />

      <div className="flex flex-col gap-2 rounded-lg border border-foreground/10 p-3">
        <TextField id="new-question" label="Pregunta del cliente" value={question} onChange={(e) => setQuestion(e.target.value)} />
        <TextField id="new-answer" label="Cómo responderías" value={answer} onChange={(e) => setAnswer(e.target.value)} />
        <Button type="button" variant="secondary" onClick={add} className="self-start">
          + Agregar ejemplo
        </Button>
      </div>

      {examples.length > 0 ? (
        <ul className="flex flex-col divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
          {examples.map((e, i) => (
            <li key={`${e.question}-${i}`} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{e.question}</p>
                <p className="text-foreground/60">{e.answer}</p>
              </div>
              <button
                type="button"
                onClick={() => setExamples(examples.filter((_, idx) => idx !== i))}
                className="shrink-0 text-xs text-foreground/40 hover:text-red-600"
              >
                Sacar
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-foreground/50">Todavía no hay ejemplos cargados.</p>
      )}

      <div className="flex justify-end">
        <SubmitButton pendingLabel="Guardando…">Guardar</SubmitButton>
      </div>
    </form>
  );
}
