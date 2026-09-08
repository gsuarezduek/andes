import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { client, MODEL } from "@/lib/competitor-prices/llm";
import { findMatch } from "@/lib/whatsapp/bot/security";
import { buildStaticSystemText, type GeneralConditions } from "@/lib/whatsapp/bot/prompt";
import type { AvailabilityToolResult } from "@/lib/whatsapp/bot/availability";
import type { ReservationSummary } from "@/lib/whatsapp/bot/my-reservations";

export type TranscriptTurn = { role: "user" | "assistant"; content: string };

export type BotReplyResult = {
  reply: string;
  escalate: boolean;
  escalateReason: string | null;
  escalateTrigger: "confidence" | "blocked_word" | null;
};

/** Ejecutores reales de las tools de datos — inyectados por el llamador (respond.ts /
 *  el Playground) para que este módulo no toque Prisma directo y siga siendo testeable. */
export type BotTools = {
  checkAvailability: (input: { startDate: string; endDate: string; vehicleQuery?: string }) => Promise<AvailabilityToolResult>;
  getMyReservations: (input: { bookingNumber?: string }) => Promise<ReservationSummary[]>;
};

const RESPOND_TOOL = {
  name: "respond",
  description: "Genera la respuesta final del bot para el cliente de WhatsApp.",
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

const CHECK_AVAILABILITY_TOOL = {
  name: "check_availability",
  description:
    "Consulta qué autos están libres para un rango de fechas (y, opcionalmente, una marca/modelo puntual). Usala siempre que el cliente pregunte por disponibilidad — nunca inventes si hay autos libres.",
  input_schema: {
    type: "object" as const,
    properties: {
      startDate: { type: "string", description: "Fecha de retiro, formato YYYY-MM-DD." },
      endDate: { type: "string", description: "Fecha de devolución, formato YYYY-MM-DD." },
      vehicleQuery: {
        type: "string",
        description: 'Opcional: marca/modelo puntual que pidió el cliente (ej. "Cronos", "camioneta"). Dejalo vacío para ver todos los disponibles.',
      },
    },
    required: ["startDate", "endDate"],
  },
};

const GET_MY_RESERVATIONS_TOOL = {
  name: "get_my_reservations",
  description:
    "Busca las reservas del cliente que te está escribiendo AHORA (nunca de otra persona) — estado, auto, fechas, total y saldo. Usala siempre que pregunte por su reserva, un saldo, o te dé un número de reserva.",
  input_schema: {
    type: "object" as const,
    properties: {
      bookingNumber: { type: "string", description: "Opcional: número de reserva que dio el cliente, tal cual lo escribió." },
    },
    required: [],
  },
};

/** Tools de datos disponibles en la fase de consulta — `respond` NUNCA entra
 *  acá: con `tool_choice: "auto"` el modelo puede simplemente no llamar
 *  ninguna, así que si `respond` compitiera en esta lista, "auto" podía
 *  resolver con texto plano sin pasar por ninguna tool y el bot escalaba
 *  siempre (bug real de producción — ver la fase forzada de abajo). */
const DATA_TOOLS = [CHECK_AVAILABILITY_TOOL, GET_MY_RESERVATIONS_TOOL];
/** Cota la cantidad de idas y vueltas de consulta de datos por mensaje (costo/latencia). */
const MAX_TOOL_ROUNDS = 4;

type RespondInput = { reply: string; escalate: boolean; escalateReason?: string };

/** Único llamado forzado a `respond` — garantiza salida estructurada siempre, tenga o no datos consultados antes. */
async function callModelForceRespond(system: Anthropic.TextBlockParam[], messages: Anthropic.MessageParam[]): Promise<RespondInput> {
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
  return toolUse.input as RespondInput;
}

async function executeDataTool(use: Anthropic.ToolUseBlock, tools: BotTools): Promise<unknown> {
  try {
    if (use.name === "check_availability") {
      return await tools.checkAvailability(use.input as { startDate: string; endDate: string; vehicleQuery?: string });
    }
    if (use.name === "get_my_reservations") {
      return await tools.getMyReservations(use.input as { bookingNumber?: string });
    }
    return { error: `Herramienta desconocida: ${use.name}` };
  } catch (err) {
    console.error(`whatsapp bot: tool ${use.name} failed`, err);
    return { error: "No se pudo consultar esta información ahora mismo." };
  }
}

/**
 * Fase de consulta: el modelo puede llamar `check_availability`/
 * `get_my_reservations` con `tool_choice: "auto"` (solo esas dos tools —
 * ver nota en `DATA_TOOLS`). En cuanto una respuesta no pide más datos
 * (`toolUses.length === 0`), corta — la respuesta final se genera aparte,
 * siempre forzada a `respond` (`callModelForceRespond`). Devuelve el
 * historial con los intercambios de tools ya resueltos.
 */
async function gatherToolData(
  system: Anthropic.TextBlockParam[],
  transcript: TranscriptTurn[],
  tools: BotTools,
): Promise<Anthropic.MessageParam[]> {
  const messages: Anthropic.MessageParam[] = transcript.map((t) => ({ role: t.role, content: t.content }));

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const msg = await client().messages.create({
      model: MODEL,
      max_tokens: 1024,
      system,
      tools: DATA_TOOLS,
      tool_choice: { type: "auto" },
      messages,
    });
    const toolUses = msg.content.filter((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
    if (toolUses.length === 0) break; // el modelo ya tiene lo que necesita para responder

    messages.push({ role: "assistant", content: msg.content as unknown as Anthropic.ContentBlockParam[] });
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const use of toolUses) {
      toolResults.push({ type: "tool_result", tool_use_id: use.id, content: JSON.stringify(await executeDataTool(use, tools)) });
    }
    messages.push({ role: "user", content: toolResults });
  }

  return messages;
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
  conditions?: GeneralConditions | null;
  contextLine: string;
  transcript: TranscriptTurn[];
  tools: BotTools;
}): Promise<BotReplyResult> {
  const staticText = buildStaticSystemText({
    prompt: input.config.prompt,
    blockedWords: input.config.blockedWords,
    escalationWords: input.config.escalationWords,
    examples: input.config.examples,
    knowledgeBlock: input.knowledgeBlock,
    conditions: input.conditions,
  });
  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: staticText, cache_control: { type: "ephemeral" } },
    { type: "text", text: input.contextLine },
  ];

  const messages = await gatherToolData(system, input.transcript, input.tools);
  const first = await callModelForceRespond(system, messages);
  if (first.escalate) {
    return { reply: first.reply, escalate: true, escalateReason: first.escalateReason ?? null, escalateTrigger: "confidence" };
  }

  const blocked = findMatch(first.reply, input.config.blockedWords);
  if (!blocked) {
    return { reply: first.reply, escalate: false, escalateReason: null, escalateTrigger: null };
  }

  // Un reintento pidiendo reformular sin la palabra bloqueada — los datos ya
  // se consultaron arriba, así que alcanza con forzar `respond` de nuevo
  // sobre una reconstrucción simple en texto plano (sin los tool_use/
  // tool_result de la fase de consulta).
  const retryMessages: TranscriptTurn[] = [
    ...input.transcript,
    { role: "assistant", content: first.reply },
    { role: "user", content: `Esa respuesta menciona algo que no podés decir ("${blocked}"). Reformulala sin eso.` },
  ];
  try {
    const second = await callModelForceRespond(system, retryMessages);
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
