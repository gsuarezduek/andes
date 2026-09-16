"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { uploadDocument } from "@/lib/whatsapp/bot/documents";
import { buildKnowledgeBlock } from "@/lib/whatsapp/bot/knowledge";
import { generateBotReply, type BotTools, type TranscriptTurn } from "@/lib/whatsapp/bot/reply";
import { checkAvailability } from "@/lib/whatsapp/bot/availability";
import { todayContextLine } from "@/lib/whatsapp/bot/rental-context";

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

/** Días para marcar "A recuperar" como vencido en el listado — ver panel "Estados". */
export async function updateFollowUpStaleDays(days: number) {
  await requireUser();
  const clamped = Math.max(1, Math.min(30, Math.round(days) || 1));
  await getOrCreateConfig();
  await prisma.whatsAppBotConfig.update({ where: { id: 1 }, data: { followUpStaleDays: clamped } });
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

/** Agrega un par pregunta/respuesta a los Ejemplos del bot (tope 20, mismo recorte que `updateExamples`). */
async function pushExample(question: string, answer: string) {
  const config = await getOrCreateConfig();
  const examples = (config.examples as { question: string; answer: string }[]).slice(0, 19);
  examples.push({ question: question.slice(0, 500), answer: answer.slice(0, 500) });
  await prisma.whatsAppBotConfig.update({ where: { id: 1 }, data: { examples } });
}

/**
 * Revisión de un caso derivado (pestaña Calidad): marca la escalación
 * resuelta y, opcionalmente, guarda "cómo debería haber respondido" el bot.
 * Si `addAsExample` viene true (requiere `correctAnswer` y que el caso tenga
 * `clientMessage`), ese par se agrega directo a los Ejemplos del bot — así el
 * caso real se convierte en entrenamiento sin pasos manuales aparte.
 */
export async function resolveEscalation(input: { escalationId: string; correctAnswer?: string; addAsExample?: boolean }) {
  const user = await requireUser();
  const escalation = await prisma.whatsAppBotEscalation.findUnique({ where: { id: input.escalationId } });
  if (!escalation) return;

  const correctAnswer = input.correctAnswer?.trim() || null;
  const addAsExample = Boolean(input.addAsExample && correctAnswer && escalation.clientMessage);

  await prisma.whatsAppBotEscalation.update({
    where: { id: input.escalationId },
    data: {
      resolvedAt: new Date(),
      resolvedById: user.id,
      correctAnswer,
      addedAsExample: addAsExample || escalation.addedAsExample,
    },
  });

  if (addAsExample) {
    await pushExample(escalation.clientMessage!, correctAnswer!);
  }

  revalidateBotPages();
}

/**
 * Playground (pestaña Probar): marca una respuesta de prueba como buena, o
 * corregida, y la guarda como Ejemplo — mismo mecanismo que "agregar como
 * ejemplo" de la pestaña Calidad (`resolveEscalation`), aplicado acá a
 * cualquier respuesta de prueba, no solo a las que terminaron escaladas.
 */
export async function addPlaygroundExample(question: string, answer: string) {
  await requireUser();
  const q = question.trim();
  const a = answer.trim();
  if (!q || !a) return;
  await pushExample(q, a);
  revalidateBotPages();
}

export type PlaygroundResult = {
  reply?: string;
  escalate?: boolean;
  escalateReason?: string | null;
  outcome?: "none" | "client_accepted" | "awaiting_client";
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
      contextLine: `Este es un mensaje de prueba desde el panel de Configuración — no es un cliente real. ${todayContextLine()}`,
      transcript,
      tools,
    });
    return { reply: result.reply, escalate: result.escalate, escalateReason: result.escalateReason, outcome: result.outcome };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo generar la respuesta." };
  }
}
