import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { MAX_DOCUMENTS } from "@/lib/whatsapp/bot/documents";
import { ButtonLink } from "@/components/ui/button";
import { BotSettingsTabs } from "@/components/whatsapp-bot/bot-settings-tabs";
import { PersonalityForm } from "@/components/whatsapp-bot/personality-form";
import { SecurityForm } from "@/components/whatsapp-bot/security-form";
import { ExamplesEditor } from "@/components/whatsapp-bot/examples-editor";
import { DocumentsPanel } from "@/components/whatsapp-bot/documents-panel";
import { QualityPanel } from "@/components/whatsapp-bot/quality-panel";
import { Playground } from "@/components/whatsapp-bot/playground";

export const metadata: Metadata = { title: "Bot de WhatsApp — Andes" };

export default async function WhatsAppBotSettingsPage() {
  await requireAdmin();

  const [config, documents, escalations] = await Promise.all([
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
  ]);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bot de WhatsApp</h1>
        <p className="text-sm text-foreground/60">Responde automáticamente los mensajes entrantes con Claude (IA).</p>
      </div>

      <BotSettingsTabs
        personality={
          <PersonalityForm enabled={config.enabled} onlyNewConversations={config.onlyNewConversations} prompt={config.prompt} />
        }
        security={
          <SecurityForm
            blockedWords={config.blockedWords as string[]}
            escalationWords={config.escalationWords as string[]}
            handoffMessage={config.handoffMessage}
          />
        }
        examples={<ExamplesEditor examples={config.examples as { question: string; answer: string }[]} />}
        documents={<DocumentsPanel documents={documents} maxDocuments={MAX_DOCUMENTS} />}
        quality={<QualityPanel escalations={escalations} />}
        playground={<Playground />}
      />

      <div>
        <ButtonLink href="/settings/whatsapp" variant="secondary">
          Volver
        </ButtonLink>
      </div>
    </div>
  );
}
