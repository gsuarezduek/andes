import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { listConversations } from "@/lib/whatsapp/conversations";
import { MAX_DOCUMENTS } from "@/lib/whatsapp/bot/documents";
import { formatDateTime } from "@/lib/datetime";
import { Badge } from "@/components/ui/badge";
import { GlobalBotToggle } from "@/components/whatsapp-bot/global-bot-toggle";
import { BotSettingsTabs } from "@/components/whatsapp-bot/bot-settings-tabs";
import { PersonalityForm } from "@/components/whatsapp-bot/personality-form";
import { SecurityForm } from "@/components/whatsapp-bot/security-form";
import { ExamplesEditor } from "@/components/whatsapp-bot/examples-editor";
import { DocumentsPanel } from "@/components/whatsapp-bot/documents-panel";
import { QualityPanel } from "@/components/whatsapp-bot/quality-panel";
import { Playground } from "@/components/whatsapp-bot/playground";

export const metadata: Metadata = { title: "WhatsApp — Andes" };

function preview(message: { body: string | null; mediaId: string | null } | null): string {
  if (!message) return "Sin mensajes todavía";
  if (message.body) return message.body;
  if (message.mediaId) return "📎 Adjunto";
  return "—";
}

export default async function WhatsAppPage({
  searchParams,
}: {
  searchParams: Promise<{ unread?: string }>;
}) {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const { unread } = await searchParams;
  const unreadOnly = unread === "1";

  const [allConversations, botData] = await Promise.all([
    listConversations(),
    isAdmin
      ? Promise.all([
          prisma.whatsAppBotConfig.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }),
          prisma.whatsAppBotDocument.findMany({
            orderBy: { createdAt: "desc" },
            select: { id: true, fileName: true, sizeBytes: true, truncated: true, summarized: true, createdAt: true },
          }),
          prisma.whatsAppBotEscalation.findMany({
            orderBy: { createdAt: "desc" },
            take: 50,
            include: { conversation: { select: { id: true, phoneE164: true, customer: { select: { name: true } } } } },
          }),
        ])
      : Promise.resolve(null),
  ]);
  const [botConfig, botDocuments, botEscalations] = botData ?? [null, null, null];
  const unreadCount = allConversations.filter((c) => c.needsReply).length;
  const conversations = unreadOnly ? allConversations.filter((c) => c.needsReply) : allConversations;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">WhatsApp</h1>
        <p className="text-sm text-foreground/60">Conversaciones con clientes.</p>
      </div>

      {botConfig ? (
        <section className="rounded-xl border border-foreground/10">
          <div className="flex items-center justify-between gap-2 px-4 py-3">
            <span className="text-sm font-medium">🤖 Bot de IA</span>
            <GlobalBotToggle enabled={botConfig.enabled} />
          </div>
          <details className="border-t border-foreground/10">
            <summary className="cursor-pointer px-4 py-2.5 text-xs font-medium text-foreground/60">
              Entrenamiento y configuración
            </summary>
            <div className="p-4 pt-0">
              <BotSettingsTabs
                personality={
                  <PersonalityForm
                    enabled={botConfig.enabled}
                    onlyNewConversations={botConfig.onlyNewConversations}
                    prompt={botConfig.prompt}
                  />
                }
                security={
                  <SecurityForm
                    blockedWords={botConfig.blockedWords as string[]}
                    escalationWords={botConfig.escalationWords as string[]}
                    handoffMessage={botConfig.handoffMessage}
                  />
                }
                examples={<ExamplesEditor examples={botConfig.examples as { question: string; answer: string }[]} />}
                documents={<DocumentsPanel documents={botDocuments!} maxDocuments={MAX_DOCUMENTS} />}
                quality={<QualityPanel escalations={botEscalations!} />}
                playground={<Playground />}
              />
            </div>
          </details>
        </section>
      ) : null}

      <div className="flex items-center gap-2 text-sm">
        <Link
          href="/whatsapp"
          className={`rounded-full px-3 py-1 font-medium transition-colors ${
            unreadOnly ? "text-foreground/60 hover:bg-foreground/5" : "bg-foreground/10 text-foreground"
          }`}
        >
          Todas ({allConversations.length})
        </Link>
        <Link
          href="/whatsapp?unread=1"
          className={`rounded-full px-3 py-1 font-medium transition-colors ${
            unreadOnly
              ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
              : "text-foreground/60 hover:bg-foreground/5"
          }`}
        >
          No leídas ({unreadCount})
        </Link>
      </div>

      {conversations.length === 0 ? (
        <p className="rounded-lg border border-foreground/10 px-4 py-3 text-sm text-foreground/50">
          {unreadOnly
            ? "No hay conversaciones no leídas."
            : "Todavía no llegó ningún mensaje. Si ya conectaste la cuenta en Configuración → WhatsApp, esperá a que un cliente escriba, o revisá que el webhook esté dado de alta en Chakra."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
          {conversations.map((c) => (
            <li key={c.id}>
              <Link
                href={`/whatsapp/${c.id}`}
                className={`flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-foreground/[0.03] ${
                  c.needsReply ? "bg-amber-500/5 dark:bg-amber-500/10" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{c.customer?.name || c.phoneE164}</p>
                    {c.needsReply ? <Badge tone="amber">No leído</Badge> : null}
                    {!c.botEnabled ? <Badge tone="red">Bot apagado</Badge> : null}
                  </div>
                  <p className="truncate text-sm text-foreground/60">{preview(c.lastMessage)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                  {c.lastMessageAt ? (
                    <span className="text-xs text-foreground/50">{formatDateTime(c.lastMessageAt)}</span>
                  ) : null}
                  {c.assignedTo ? <span className="text-xs text-foreground/50">{c.assignedTo.name}</span> : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
