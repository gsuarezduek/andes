"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useAutosave } from "@/components/whatsapp-bot/use-autosave";
import { testBotPlayground, addPlaygroundExample } from "@/app/(app)/settings/whatsapp/bot/actions";
import type { TranscriptTurn } from "@/lib/whatsapp/bot/reply";

type Turn = TranscriptTurn & { escalate?: boolean; outcome?: "none" | "client_accepted" | "awaiting_client" };

const OUTCOME_LABEL: Record<string, string> = {
  client_accepted: "✅ Pasaría a \"A confirmar\"",
  awaiting_client: "🕒 Pasaría a \"A recuperar\"",
};

/** El mensaje del cliente que motivó esta respuesta — el turno "user" inmediato anterior. */
function questionFor(turns: Turn[], assistantIndex: number): string {
  for (let i = assistantIndex - 1; i >= 0; i--) {
    if (turns[i].role === "user") return turns[i].content;
  }
  return "";
}

function Feedback({ turns, index }: { turns: Turn[]; index: number }) {
  const { pending, saved, run } = useAutosave();
  const [editing, setEditing] = useState(false);
  const [correction, setCorrection] = useState(turns[index].content);
  const question = questionFor(turns, index);

  if (!question) return null;

  if (saved) {
    return <span className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">✓ Guardado como ejemplo</span>;
  }

  if (editing) {
    return (
      <div className="mt-1 flex w-full max-w-[85%] flex-col gap-1.5">
        <textarea
          value={correction}
          onChange={(e) => setCorrection(e.target.value)}
          rows={2}
          className="w-full resize-none rounded-lg border border-foreground/15 bg-transparent p-2 text-sm outline-none focus:border-foreground/40"
        />
        <div className="flex gap-2">
          <Button
            type="button"
            disabled={pending || !correction.trim()}
            onClick={() => run(() => addPlaygroundExample(question, correction))}
          >
            Guardar corrección
          </Button>
          <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1 flex gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => addPlaygroundExample(question, turns[index].content))}
        className="text-xs text-foreground/50 hover:text-emerald-600 disabled:opacity-50 dark:hover:text-emerald-400"
      >
        ✓ Está bien
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setEditing(true)}
        className="text-xs text-foreground/50 hover:text-red-600 disabled:opacity-50 dark:hover:text-red-400"
      >
        ✗ Está mal
      </button>
    </div>
  );
}

/**
 * Corre la config YA GUARDADA (personalidad/seguridad/ejemplos/documentos)
 * contra una conversación de prueba armada acá — no persiste ni manda nada
 * real por WhatsApp, pero sigue gastando tokens reales. Cada respuesta se
 * puede marcar como buena o corregir — ambas se guardan como Ejemplo, para
 * ir entrenando al bot con estas pruebas.
 */
export function Playground() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setError(null);
    const next: Turn[] = [...turns, { role: "user", content: text }];
    setTurns(next);
    setDraft("");
    start(async () => {
      const result = await testBotPlayground(next.map(({ role, content }) => ({ role, content })));
      if (result.error) {
        setError(result.error);
        return;
      }
      setTurns([...next, { role: "assistant", content: result.reply ?? "", escalate: result.escalate, outcome: result.outcome }]);
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-foreground/60">
        Probá cómo respondería el bot ahora mismo, sin mandar nada real. Marcá cada respuesta como buena o corregila —
        queda guardada como Ejemplo para la próxima.
      </p>
      <div className="flex min-h-[200px] flex-col gap-2 rounded-xl border border-foreground/10 p-3">
        {turns.length === 0 ? (
          <p className="text-sm text-foreground/40">Escribí como si fueras un cliente…</p>
        ) : (
          turns.map((t, i) => (
            <div key={i} className={`flex flex-col ${t.role === "user" ? "items-end" : "items-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  t.role === "user" ? "bg-foreground text-background" : "bg-foreground/[0.06]"
                }`}
              >
                {t.content}
              </div>
              {t.escalate ? <span className="mt-1 text-xs text-amber-600 dark:text-amber-400">🚩 Esto pasaría a un humano</span> : null}
              {t.outcome && t.outcome !== "none" ? (
                <span className="mt-1 text-xs text-foreground/50">{OUTCOME_LABEL[t.outcome]}</span>
              ) : null}
              {t.role === "assistant" ? <Feedback turns={turns} index={i} /> : null}
            </div>
          ))
        )}
        {pending ? <p className="text-sm text-foreground/40">Pensando…</p> : null}
      </div>
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      <div className="flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          placeholder="Escribí un mensaje de prueba…"
          className="min-h-[2.5rem] w-full flex-1 resize-none rounded-lg border border-foreground/15 bg-transparent p-2.5 text-base outline-none focus:border-foreground/40"
        />
        <Button type="button" onClick={send} disabled={pending}>
          Enviar
        </Button>
      </div>
    </div>
  );
}
