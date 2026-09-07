import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { listConversations } from "@/lib/whatsapp/conversations";
import { MAX_DOCUMENTS } from "@/lib/whatsapp/bot/documents";
import { ConversationList } from "@/components/whatsapp/conversation-list";
import { GlobalBotToggle } from "@/components/whatsapp-bot/global-bot-toggle";
import { BotSettingsTabs } from "@/components/whatsapp-bot/bot-settings-tabs";
import { PersonalityForm } from "@/components/whatsapp-bot/personality-form";
import { SecurityForm } from "@/components/whatsapp-bot/security-form";
import { ExamplesEditor } from "@/components/whatsapp-bot/examples-editor";
import { DocumentsPanel } from "@/components/whatsapp-bot/documents-panel";
import { QualityPanel } from "@/components/whatsapp-bot/quality-panel";
import { Playground } from "@/components/whatsapp-bot/playground";

export const metadata: Metadata = { title: "WhatsApp — Andes" };

function FilterTabs({ allCount, unreadCount, unreadOnly }: { allCount: number; unreadCount: number; unreadOnly: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5 text-sm">
      <Link
        href="/whatsapp"
        className={`rounded-full px-3 py-1 font-medium transition-colors ${
          unreadOnly ? "text-foreground/60 hover:bg-foreground/5" : "bg-foreground/10 text-foreground"
        }`}
      >
        Todas ({allCount})
      </Link>
      <Link
        href="/whatsapp?unread=1"
        className={`rounded-full px-3 py-1 font-medium transition-colors ${
          unreadOnly ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "text-foreground/60 hover:bg-foreground/5"
        }`}
      >
        No leídas ({unreadCount})
      </Link>
    </div>
  );
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

      {conversations.length === 0 ? (
        <>
          <FilterTabs allCount={allConversations.length} unreadCount={unreadCount} unreadOnly={unreadOnly} />
          <p className="rounded-lg border border-foreground/10 px-4 py-3 text-sm text-foreground/50">
            {unreadOnly
              ? "No hay conversaciones no leídas."
              : "Todavía no llegó ningún mensaje. Si ya conectaste la cuenta en Configuración → WhatsApp, esperá a que un cliente escriba, o revisá que el webhook esté dado de alta en Chakra."}
          </p>
        </>
      ) : (
        <ConversationList
          conversations={conversations}
          filters={<FilterTabs allCount={allConversations.length} unreadCount={unreadCount} unreadOnly={unreadOnly} />}
        />
      )}
    </div>
  );
}
