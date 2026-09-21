"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDateTime } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { useAutosave } from "@/components/whatsapp-bot/use-autosave";
import { resolveEscalation } from "@/app/(app)/settings/whatsapp/bot/actions";

const TRIGGER_LABEL: Record<string, string> = {
  confidence: "El bot no estaba seguro",
  escalation_word: "Palabra de derivación",
  blocked_word: "Palabra bloqueada en la respuesta",
};

type Escalation = {
  id: string;
  trigger: string;
  reason: string | null;
  clientMessage: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
  correctAnswer: string | null;
  addedAsExample: boolean;
  resolvedByName: string | null;
  conversation: { id: string; phoneE164: string; customer: { name: string | null } | null };
};

function PendingRow({ e }: { e: Escalation }) {
  const { pending, run } = useAutosave();
  const [answer, setAnswer] = useState("");
  const [justResolved, setJustResolved] = useState(false);

  if (justResolved) return null;

  return (
    <li className="flex flex-col gap-2 px-4 py-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <Link href={`/whatsapp/${e.conversation.id}`} className="font-medium hover:underline">
          {e.conversation.customer?.name || e.conversation.phoneE164}
        </Link>
        <span className="text-xs text-foreground/50">{formatDateTime(e.createdAt)}</span>
      </div>
      <p className="text-xs text-foreground/60">{TRIGGER_LABEL[e.trigger] ?? e.trigger}{e.reason ? ` — ${e.reason}` : ""}</p>
      {e.clientMessage ? <p className="text-foreground/70">&quot;{e.clientMessage}&quot;</p> : null}

      <textarea
        value={answer}
        onChange={(ev) => setAnswer(ev.target.value)}
        placeholder="¿Cómo debería haber respondido el bot? (opcional)"
        rows={2}
        className="mt-1 w-full rounded-lg border border-foreground/15 bg-transparent p-2 text-sm outline-none focus:border-foreground/40"
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            run(async () => {
              await resolveEscalation({ escalationId: e.id, correctAnswer: answer || undefined });
              setJustResolved(true);
            })
          }
        >
          Marcar resuelto
        </Button>
        <Button
          type="button"
          disabled={pending || !answer.trim() || !e.clientMessage}
          onClick={() =>
            run(async () => {
              await resolveEscalation({ escalationId: e.id, correctAnswer: answer, addAsExample: true });
              setJustResolved(true);
            })
          }
        >
          Guardar y agregar como ejemplo
        </Button>
      </div>
      {!e.clientMessage ? (
        <p className="text-xs text-foreground/40">Este caso no tiene el mensaje del cliente guardado — no se puede convertir en ejemplo.</p>
      ) : null}
    </li>
  );
}

function ResolvedRow({ e }: { e: Escalation }) {
  return (
    <li className="flex flex-col gap-1 px-4 py-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <Link href={`/whatsapp/${e.conversation.id}`} className="font-medium hover:underline">
          {e.conversation.customer?.name || e.conversation.phoneE164}
        </Link>
        <span className="text-xs text-foreground/50">{formatDateTime(e.createdAt)}</span>
      </div>
      <p className="text-xs text-foreground/60">{TRIGGER_LABEL[e.trigger] ?? e.trigger}{e.reason ? ` — ${e.reason}` : ""}</p>
      {e.clientMessage ? <p className="text-foreground/70">&quot;{e.clientMessage}&quot;</p> : null}
      {e.correctAnswer ? (
        <p className="text-emerald-700 dark:text-emerald-400">Respuesta correcta: &quot;{e.correctAnswer}&quot;</p>
      ) : null}
      <p className="text-xs text-foreground/40">
        Resuelto{e.resolvedByName ? ` por ${e.resolvedByName}` : ""}
        {e.resolvedAt ? ` · ${formatDateTime(e.resolvedAt)}` : ""}
        {e.addedAsExample ? " · agregado como ejemplo" : ""}
      </p>
    </li>
  );
}

/** Casos reales donde el bot pasó la conversación a un humano — para revisar y, si corresponde, enseñarle la respuesta correcta. */
export function QualityPanel({ escalations }: { escalations: Escalation[] }) {
  const pending = escalations.filter((e) => !e.resolvedAt);
  const resolved = escalations.filter((e) => e.resolvedAt);

  if (escalations.length === 0) {
    return <p className="text-sm text-foreground/50">Todavía no hubo ningún caso derivado a un humano.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {pending.length > 0 ? (
        <ul className="flex flex-col divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
          {pending.map((e) => (
            <PendingRow key={e.id} e={e} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-foreground/50">No hay casos pendientes de revisar.</p>
      )}

      {resolved.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-xs font-medium text-foreground/60">Historial ({resolved.length})</summary>
          <ul className="mt-2 flex flex-col divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
            {resolved.map((e) => (
              <ResolvedRow key={e.id} e={e} />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
