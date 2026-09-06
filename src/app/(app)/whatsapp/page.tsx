import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";
import { listConversations } from "@/lib/whatsapp/conversations";
import { formatDateTime } from "@/lib/datetime";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "WhatsApp — Andes" };

function preview(message: { body: string | null; mediaId: string | null } | null): string {
  if (!message) return "Sin mensajes todavía";
  if (message.body) return message.body;
  if (message.mediaId) return "📎 Adjunto";
  return "—";
}

export default async function WhatsAppPage() {
  await requireUser();
  const conversations = await listConversations();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">WhatsApp</h1>
        <p className="text-sm text-foreground/60">Conversaciones con clientes.</p>
      </div>

      {conversations.length === 0 ? (
        <p className="rounded-lg border border-foreground/10 px-4 py-3 text-sm text-foreground/50">
          Todavía no llegó ningún mensaje. Si ya conectaste la cuenta en Configuración → WhatsApp, esperá a que un
          cliente escriba, o revisá que el webhook esté dado de alta en Chakra.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
          {conversations.map((c) => (
            <li key={c.id}>
              <Link
                href={`/whatsapp/${c.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-foreground/[0.03]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{c.customer?.name || c.phoneE164}</p>
                    {!c.botEnabled ? <Badge tone="red">Bot apagado</Badge> : null}
                  </div>
                  <p className="truncate text-sm text-foreground/60">{preview(c.lastMessage)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                  {c.lastMessageAt ? (
                    <span className="text-xs text-foreground/50">{formatDateTime(c.lastMessageAt)}</span>
                  ) : null}
                  {c.assignedTo ? (
                    <span className="text-xs text-foreground/50">{c.assignedTo.name}</span>
                  ) : (
                    <span className="text-xs text-foreground/30">Sin asignar</span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
