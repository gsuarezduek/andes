import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { listConversations } from "@/lib/whatsapp/conversations";
import { MAX_DOCUMENTS } from "@/lib/whatsapp/bot/documents";
import { ConversationList } from "@/components/whatsapp/conversation-list";
import { AutoRefresh } from "@/components/auto-refresh";
import { GlobalBotToggle } from "@/components/whatsapp-bot/global-bot-toggle";
import { BotTrainingPanel } from "@/components/whatsapp-bot/bot-training-panel";
import { BotSettingsTabs } from "@/components/whatsapp-bot/bot-settings-tabs";
import { PersonalityForm } from "@/components/whatsapp-bot/personality-form";
import { PoliciesEditor } from "@/components/whatsapp-bot/policies-editor";
import { SecurityForm } from "@/components/whatsapp-bot/security-form";
import { StatesPanel } from "@/components/whatsapp-bot/states-panel";
import { ExamplesEditor } from "@/components/whatsapp-bot/examples-editor";
import { DocumentsPanel } from "@/components/whatsapp-bot/documents-panel";
import { QualityPanel } from "@/components/whatsapp-bot/quality-panel";
import { Playground } from "@/components/whatsapp-bot/playground";

export const metadata: Metadata = { title: "WhatsApp — Andes" };

type FilterValue = "all" | "confirm" | "transfer" | "unread" | "confirmed" | "followup";

const FILTER_TABS: { value: FilterValue; label: string; activeClass: string }[] = [
  { value: "all", label: "Todas", activeClass: "bg-foreground/10 text-foreground" },
  { value: "confirm", label: "A confirmar", activeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  { value: "transfer", label: "Transferidos", activeClass: "bg-red-500/15 text-red-700 dark:text-red-400" },
  { value: "unread", label: "No leídas", activeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  { value: "confirmed", label: "Confirmado", activeClass: "bg-violet-500/15 text-violet-700 dark:text-violet-400" },
  { value: "followup", label: "A recuperar", activeClass: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
];

function FilterTabs({ counts, active }: { counts: Record<FilterValue, number>; active: FilterValue }) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5 text-sm">
      {FILTER_TABS.map((tab) => (
        <Link
          key={tab.value}
          href={tab.value === "all" ? "/whatsapp" : `/whatsapp?filter=${tab.value}`}
          className={`rounded-full px-3 py-1 font-medium transition-colors ${
            active === tab.value ? tab.activeClass : "text-foreground/60 hover:bg-foreground/5"
          }`}
        >
          {tab.label} ({counts[tab.value]})
        </Link>
      ))}
    </div>
  );
}

const EMPTY_STATE_LABEL: Record<FilterValue, string> = {
  all: "",
  confirm: "No hay conversaciones en \"A confirmar\".",
  transfer: "No hay conversaciones transferidas.",
  unread: "No hay conversaciones no leídas.",
  confirmed: "No hay conversaciones marcadas \"Confirmado\".",
  followup: "No hay conversaciones en \"A recuperar\".",
};

export default async function WhatsAppPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  await requireUser();
  const { filter } = await searchParams;
  const active: FilterValue =
    filter === "confirm" || filter === "transfer" || filter === "unread" || filter === "confirmed" || filter === "followup"
      ? filter
      : "all";

  // Bot de IA y entrenamiento: visible para cualquier empleado, no solo admin
  // — es entrenamiento en equipo, no una función administrativa.
  const [allConversations, botConfig, botDocuments, botEscalations] = await Promise.all([
    listConversations(),
    prisma.whatsAppBotConfig.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }),
    prisma.whatsAppBotDocument.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, fileName: true, sizeBytes: true, truncated: true, summarized: true, createdAt: true },
    }),
    prisma.whatsAppBotEscalation.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        conversation: { select: { id: true, phoneE164: true, customer: { select: { name: true } } } },
        resolvedBy: { select: { name: true } },
      },
    }),
  ]);
  const counts: Record<FilterValue, number> = {
    all: allConversations.length,
    confirm: allConversations.filter((c) => c.state === "confirm").length,
    transfer: allConversations.filter((c) => c.state === "transfer").length,
    unread: allConversations.filter((c) => c.state === "unread").length,
    confirmed: allConversations.filter((c) => c.state === "confirmed").length,
    followup: allConversations.filter((c) => c.state === "followup").length,
  };
  const conversations = active === "all" ? allConversations : allConversations.filter((c) => c.state === active);

  return (
    <div className="flex flex-col gap-5">
      <AutoRefresh intervalMs={15000} />
      <div>
        <h1 className="text-2xl font-bold tracking-tight">WhatsApp</h1>
        <p className="text-sm text-foreground/60">Conversaciones con clientes.</p>
      </div>

      <BotTrainingPanel globalToggle={<GlobalBotToggle enabled={botConfig.enabled} />}>
        <BotSettingsTabs
          personality={
            <PersonalityForm
              enabled={botConfig.enabled}
              onlyNewConversations={botConfig.onlyNewConversations}
              trainingPhones={botConfig.trainingPhones as string[]}
              prompt={botConfig.prompt}
            />
          }
          policies={<PoliciesEditor policies={botConfig.policies as { topic: string; text: string }[]} />}
          security={
            <SecurityForm
              blockedWords={botConfig.blockedWords as string[]}
              escalationWords={botConfig.escalationWords as string[]}
              handoffMessage={botConfig.handoffMessage}
            />
          }
          states={<StatesPanel followUpStaleDays={botConfig.followUpStaleDays} />}
          examples={<ExamplesEditor examples={botConfig.examples as { question: string; answer: string }[]} />}
          documents={<DocumentsPanel documents={botDocuments} maxDocuments={MAX_DOCUMENTS} />}
          quality={<QualityPanel escalations={botEscalations} />}
          playground={<Playground />}
        />
      </BotTrainingPanel>

      {conversations.length === 0 ? (
        <>
          <FilterTabs counts={counts} active={active} />
          <p className="rounded-lg border border-foreground/10 px-4 py-3 text-sm text-foreground/50">
            {active === "all"
              ? "Todavía no llegó ningún mensaje. Si ya conectaste la cuenta en Configuración → WhatsApp, esperá a que un cliente escriba, o revisá que el webhook esté dado de alta en Chakra."
              : EMPTY_STATE_LABEL[active]}
          </p>
        </>
      ) : (
        <ConversationList
          conversations={conversations}
          filters={<FilterTabs counts={counts} active={active} />}
          globalBotEnabled={botConfig.enabled}
          followUpStaleDays={botConfig.followUpStaleDays}
        />
      )}
    </div>
  );
}
