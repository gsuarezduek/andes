import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { client, MODEL } from "@/lib/competitor-prices/llm";
import { findMatch } from "@/lib/whatsapp/bot/security";
import { buildStaticSystemText } from "@/lib/whatsapp/bot/prompt";

export type TranscriptTurn = { role: "user" | "assistant"; content: string };

export type BotReplyResult = {
  reply: string;
  escalate: boolean;
  escalateReason: string | null;
  escalateTrigger: "confidence" | "blocked_word" | null;
};

const RESPOND_TOOL = {
  name: "respond",
  description: "Genera la respuesta del bot para el cliente de WhatsApp.",
  input_schema: {
    type: "object" as const,
    properties: {
      reply: { type: "string", description: "El mensaje a mandar al cliente. Breve, en español, tono amable." },
      escalate: { type: "boolean", description: "true si hay que derivar a un humano en vez de mandar `reply`." },
      escalateReason: { type: "string", description: "Motivo breve, solo si escalate=true." },
    },
    required: ["reply", "escalate"],
  },
};

async function callModel(system: Anthropic.TextBlockParam[], messages: TranscriptTurn[]) {
  const msg = await client().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system,
    tools: [RESPOND_TOOL],
    tool_choice: { type: "tool", name: "respond" },
    messages,
  });
  const toolUse = msg.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("El modelo no devolvió una respuesta.");
  return toolUse.input as { reply: string; escalate: boolean; escalateReason?: string };
}

/**
 * Genera la respuesta del bot. El chequeo de `escalationWords` contra el
 * último mensaje del cliente pasa ANTES de llegar acá (ver respond.ts) para
 * no gastar el llamado; acá solo se revisan `blockedWords` contra la
 * respuesta YA generada, con 1 reintento pidiendo reformular.
 */
export async function generateBotReply(input: {
  config: {
    prompt: string;
    blockedWords: string[];
    escalationWords: string[];
    examples: { question: string; answer: string }[];
  };
  knowledgeBlock: string | null;
  contextLine: string;
  transcript: TranscriptTurn[];
}): Promise<BotReplyResult> {
  const staticText = buildStaticSystemText({
    prompt: input.config.prompt,
    blockedWords: input.config.blockedWords,
    escalationWords: input.config.escalationWords,
    examples: input.config.examples,
    knowledgeBlock: input.knowledgeBlock,
  });
  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: staticText, cache_control: { type: "ephemeral" } },
    { type: "text", text: input.contextLine },
  ];

  const first = await callModel(system, input.transcript);
  if (first.escalate) {
    return { reply: first.reply, escalate: true, escalateReason: first.escalateReason ?? null, escalateTrigger: "confidence" };
  }

  const blocked = findMatch(first.reply, input.config.blockedWords);
  if (!blocked) {
    return { reply: first.reply, escalate: false, escalateReason: null, escalateTrigger: null };
  }

  // Un reintento pidiendo reformular sin la palabra bloqueada.
  const retryMessages: TranscriptTurn[] = [
    ...input.transcript,
    { role: "assistant", content: first.reply },
    { role: "user", content: `Esa respuesta menciona algo que no podés decir ("${blocked}"). Reformulala sin eso.` },
  ];
  try {
    const second = await callModel(system, retryMessages);
    if (!second.escalate && !findMatch(second.reply, input.config.blockedWords)) {
      return { reply: second.reply, escalate: false, escalateReason: null, escalateTrigger: null };
    }
  } catch {
    // el reintento falló — cae al handoff de abajo
  }
  return {
    reply: first.reply,
    escalate: true,
    escalateReason: `La respuesta generada mencionaba una palabra bloqueada ("${blocked}") y el reintento no la resolvió.`,
    escalateTrigger: "blocked_word",
  };
}
