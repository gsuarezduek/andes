import Link from "next/link";
import { formatDateTime } from "@/lib/datetime";

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
  conversation: { id: string; phoneE164: string; customer: { name: string | null } | null };
};

/** Casos reales donde el bot pasó la conversación a un humano — para revisar en vez de ajustar el prompt a ciegas. */
export function QualityPanel({ escalations }: { escalations: Escalation[] }) {
  if (escalations.length === 0) {
    return <p className="text-sm text-foreground/50">Todavía no hubo ningún caso derivado a un humano.</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
      {escalations.map((e) => (
        <li key={e.id} className="flex flex-col gap-1 px-4 py-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <Link href={`/whatsapp/${e.conversation.id}`} className="font-medium hover:underline">
              {e.conversation.customer?.name || e.conversation.phoneE164}
            </Link>
            <span className="text-xs text-foreground/50">{formatDateTime(e.createdAt)}</span>
          </div>
          <p className="text-xs text-foreground/60">{TRIGGER_LABEL[e.trigger] ?? e.trigger}{e.reason ? ` — ${e.reason}` : ""}</p>
          {e.clientMessage ? <p className="text-foreground/70">&quot;{e.clientMessage}&quot;</p> : null}
        </li>
      ))}
    </ul>
  );
}
