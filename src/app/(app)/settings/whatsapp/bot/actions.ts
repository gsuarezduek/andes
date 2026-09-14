"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { uploadDocument } from "@/lib/whatsapp/bot/documents";
import { buildKnowledgeBlock } from "@/lib/whatsapp/bot/knowledge";
import { generateBotReply, type BotTools, type TranscriptTurn } from "@/lib/whatsapp/bot/reply";
import { checkAvailability } from "@/lib/whatsapp/bot/availability";

// Todas las acciones de esta pestaña usan `requireUser` (no `requireAdmin`) a
// propósito: es "entrenamiento en equipo" — cualquier empleado carga
// políticas/ejemplos, no solo un admin.

export type ActionState = { ok?: boolean; error?: string };

async function getOrCreateConfig() {
  return prisma.whatsAppBotConfig.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
}

/** Estos forms/paneles se reusan en dos páginas (Configuración y el inbox de WhatsApp) — revalidar ambas. */
function revalidateBotPages() {
  revalidatePath("/settings/whatsapp/bot");
  revalidatePath("/whatsapp");
}

/** Prender/apagar el bot sin tocar el resto de la config — el switch rápido de `/whatsapp`. */
export async function toggleGlobalBot(enabled: boolean) {
  await requireUser();
  await prisma.whatsAppBotConfig.upsert({
    where: { id: 1 },
    create: { id: 1, enabled },
    update: { enabled },
  });
  revalidateBotPages();
}

type PersonalityPatch = Partial<{
  enabled: boolean;
  onlyNewConversations: boolean;
  trainingPhones: string[];
  prompt: string;
}>;

/** Autoguardado: se llama en cada cambio (checkbox, chip agregada/sacada, o texto con debounce) — sin botón "Guardar". */
export async function updatePersonality(patch: PersonalityPatch) {
  await requireUser();
  await getOrCreateConfig();
  await prisma.whatsAppBotConfig.update({ where: { id: 1 }, data: patch });
  revalidateBotPages();
}

type SecurityPatch = Partial<{
  blockedWords: string[];
  escalationWords: string[];
  handoffMessage: string | null;
}>;

export async function updateSecurity(patch: SecurityPatch) {
  await requireUser();
  await getOrCreateConfig();
  await prisma.whatsAppBotConfig.update({ where: { id: 1 }, data: patch });
  revalidateBotPages();
}

export async function updateExamples(examples: { question: string; answer: string }[]) {
  await requireUser();
  const trimmed = examples.slice(0, 20).map((e) => ({ question: e.question.slice(0, 500), answer: e.answer.slice(0, 500) }));
  await getOrCreateConfig();
  await prisma.whatsAppBotConfig.update({ where: { id: 1 }, data: { examples: trimmed } });
  revalidateBotPages();
}

export async function updatePolicies(policies: { topic: string; text: string }[]) {
  await requireUser();
  const trimmed = policies.map((p) => ({ topic: p.topic.slice(0, 200), text: p.text.slice(0, 2000) }));
  await getOrCreateConfig();
  await prisma.whatsAppBotConfig.update({ where: { id: 1 }, data: { policies: trimmed } });
  revalidateBotPages();
}

export async function uploadBotDocument(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Elegí un archivo." };
  }
  try {
    await uploadDocument(file);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo subir el documento." };
  }
  revalidateBotPages();
  return { ok: true };
}

export async function deleteBotDocument(id: string) {
  await requireUser();
  const doc = await prisma.whatsAppBotDocument.findUnique({ where: { id } });
  if (!doc) return;
  await prisma.whatsAppBotDocument.delete({ where: { id } });
  revalidateBotPages();
}

export type PlaygroundResult = {
  reply?: string;
  escalate?: boolean;
  escalateReason?: string | null;
  error?: string;
};

/**
 * Playground: corre `generateBotReply` con la config YA GUARDADA (personalidad,
 * seguridad, ejemplos, documentos) contra una transcripción armada en el
 * frontend. No persiste ni manda nada real por WhatsApp.
 */
export async function testBotPlayground(transcript: TranscriptTurn[]): Promise<PlaygroundResult> {
  await requireUser();
  const [config, knowledgeBlock, conditions] = await Promise.all([
    getOrCreateConfig(),
    buildKnowledgeBlock(),
    prisma.conditionSettings.findUnique({ where: { id: 1 } }),
  ]);

  // `check_availability` es dato de negocio real, no sensible — se ejercita
  // de verdad en la prueba. `get_my_reservations` no tiene un teléfono/
  // conversación real detrás en el playground, así que devuelve vacío (el
  // modelo lo interpreta igual que un cliente sin reservas registradas).
  const tools: BotTools = {
    checkAvailability: (i) => checkAvailability(i),
    getMyReservations: async () => [],
  };

  try {
    const result = await generateBotReply({
      config: {
        prompt: config.prompt,
        blockedWords: config.blockedWords as string[],
        escalationWords: config.escalationWords as string[],
        examples: config.examples as { question: string; answer: string }[],
      },
      knowledgeBlock,
      conditions: conditions
        ? {
            kmPerDay: conditions.kmPerDay,
            extraKmRate: conditions.extraKmRate != null ? Number(conditions.extraKmRate) : null,
            deductible: conditions.deductible != null ? Number(conditions.deductible) : null,
            deductibleReduced: conditions.deductibleReduced != null ? Number(conditions.deductibleReduced) : null,
          }
        : null,
      policies: config.policies as { topic: string; text: string }[],
      contextLine: "Este es un mensaje de prueba desde el panel de Configuración — no es un cliente real.",
      transcript,
      tools,
    });
    return { reply: result.reply, escalate: result.escalate, escalateReason: result.escalateReason };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo generar la respuesta." };
  }
}
