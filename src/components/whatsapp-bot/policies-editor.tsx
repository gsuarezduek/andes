"use client";

import { useState } from "react";
import { TextField, TextareaField } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import { AutosaveStatus } from "@/components/whatsapp-bot/autosave-status";
import { useAutosave } from "@/components/whatsapp-bot/use-autosave";
import { updatePolicies } from "@/app/(app)/settings/whatsapp/bot/actions";

type Policy = { topic: string; text: string };

export function PoliciesEditor({ policies: initial }: { policies: Policy[] }) {
  const { pending, saved, run } = useAutosave();
  const [policies, setPolicies] = useState<Policy[]>(initial);
  const [topic, setTopic] = useState("");
  const [text, setText] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const save = () => {
    if (!topic.trim() || !text.trim()) return;
    const entry = { topic: topic.trim(), text: text.trim() };
    const next =
      editingIndex === null ? [...policies, entry] : policies.map((p, idx) => (idx === editingIndex ? entry : p));
    setPolicies(next);
    setTopic("");
    setText("");
    setEditingIndex(null);
    run(() => updatePolicies(next));
  };

  const edit = (i: number) => {
    setTopic(policies[i].topic);
    setText(policies[i].text);
    setEditingIndex(i);
  };

  const cancelEdit = () => {
    setTopic("");
    setText("");
    setEditingIndex(null);
  };

  const remove = (i: number) => {
    const next = policies.filter((_, idx) => idx !== i);
    setPolicies(next);
    if (editingIndex === i) cancelEdit();
    run(() => updatePolicies(next));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-foreground/60">
          Datos fijos del negocio, un tema por entrada (horarios, cruce a Chile, cancelación, conductores adicionales,
          etc.) — separado del prompt de personalidad para que puedas ir directo a actualizar uno sin releer todo. El
          bot los toma como la verdad, por encima de cualquier documento que los contradiga. Se guardan solos.
        </p>
        <AutosaveStatus pending={pending} saved={saved} />
      </div>

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
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={save} className="self-start">
            {editingIndex === null ? "+ Agregar tema" : "Guardar cambios"}
          </Button>
          {editingIndex !== null ? (
            <button type="button" onClick={cancelEdit} className="text-xs text-foreground/50 hover:text-foreground">
              Cancelar
            </button>
          ) : null}
        </div>
      </div>

      {policies.length > 0 ? (
        <ul className="flex flex-col divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
          {policies.map((p, i) => (
            <li
              key={`${p.topic}-${i}`}
              className={`flex items-start justify-between gap-3 px-4 py-3 text-sm ${
                editingIndex === i ? "bg-amber-500/10" : ""
              }`}
            >
              <div>
                <p className="font-medium">{p.topic}</p>
                <p className="whitespace-pre-wrap text-foreground/60">{p.text}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <button type="button" onClick={() => edit(i)} className="text-xs text-foreground/40 hover:text-foreground">
                  Editar
                </button>
                <button type="button" onClick={() => remove(i)} className="text-xs text-foreground/40 hover:text-red-600">
                  Sacar
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-foreground/50">Todavía no hay temas cargados.</p>
      )}
    </div>
  );
}
