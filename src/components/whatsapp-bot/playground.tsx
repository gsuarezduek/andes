"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { testBotPlayground } from "@/app/(app)/settings/whatsapp/bot/actions";
import type { TranscriptTurn } from "@/lib/whatsapp/bot/reply";

type Turn = TranscriptTurn & { escalate?: boolean };

/**
 * Corre la config YA GUARDADA (personalidad/seguridad/ejemplos/documentos)
 * contra una conversación de prueba armada acá — no persiste ni manda nada
 * real por WhatsApp, pero sigue gastando tokens reales.
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
      setTurns([...next, { role: "assistant", content: result.reply ?? "", escalate: result.escalate }]);
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-foreground/60">Probá cómo respondería el bot ahora mismo, sin mandar nada real.</p>
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
