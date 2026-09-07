"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { uploadDocument } from "@/lib/whatsapp/bot/documents";
import { buildKnowledgeBlock } from "@/lib/whatsapp/bot/knowledge";
import { generateBotReply, type BotTools, type TranscriptTurn } from "@/lib/whatsapp/bot/reply";
import { checkAvailability } from "@/lib/whatsapp/bot/availability";

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
  await requireAdmin();
  await prisma.whatsAppBotConfig.upsert({
    where: { id: 1 },
    create: { id: 1, enabled },
    update: { enabled },
  });
  revalidateBotPages();
}

export async function savePersonality(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const enabled = formData.get("enabled") === "on";
  const onlyNewConversations = formData.get("onlyNewConversations") === "on";
  const prompt = String(formData.get("prompt") ?? "").trim();

  await prisma.whatsAppBotConfig.upsert({
    where: { id: 1 },
    create: { id: 1, enabled, onlyNewConversations, prompt },
    update: { enabled, onlyNewConversations, prompt },
  });
  revalidateBotPages();
  return { ok: true };
}

function parseWordList(raw: FormDataEntryValue | null): string[] {
  try {
    const arr = JSON.parse(String(raw ?? "[]"));
    return Array.isArray(arr) ? arr.filter((w): w is string => typeof w === "string" && w.trim().length > 0) : [];
  } catch {
    return [];
  }
}

export async function saveSecurity(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const blockedWords = parseWordList(formData.get("blockedWords"));
  const escalationWords = parseWordList(formData.get("escalationWords"));
  const handoffMessage = String(formData.get("handoffMessage") ?? "").trim() || null;

  await getOrCreateConfig();
  await prisma.whatsAppBotConfig.update({ where: { id: 1 }, data: { blockedWords, escalationWords, handoffMessage } });
  revalidateBotPages();
  return { ok: true };
}

export async function saveExamples(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  let examples: { question: string; answer: string }[];
  try {
    const parsed = JSON.parse(String(formData.get("examples") ?? "[]"));
    examples = Array.isArray(parsed)
      ? parsed
          .filter((e) => e && typeof e.question === "string" && typeof e.answer === "string")
          .slice(0, 20)
          .map((e) => ({ question: e.question.slice(0, 500), answer: e.answer.slice(0, 500) }))
      : [];
  } catch {
    return { error: "Formato inválido." };
  }

  await getOrCreateConfig();
  await prisma.whatsAppBotConfig.update({ where: { id: 1 }, data: { examples } });
  revalidateBotPages();
  return { ok: true };
}

export async function uploadBotDocument(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
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
  await requireAdmin();
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
  await requireAdmin();
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
      contextLine: "Este es un mensaje de prueba desde el panel de Configuración — no es un cliente real.",
      transcript,
      tools,
    });
    return { reply: result.reply, escalate: result.escalate, escalateReason: result.escalateReason };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo generar la respuesta." };
  }
}
