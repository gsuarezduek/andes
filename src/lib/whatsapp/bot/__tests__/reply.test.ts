import { describe, it, expect, vi, beforeEach } from "vitest";

const createMock = vi.fn();
vi.mock("@/lib/competitor-prices/llm", () => ({
  MODEL: "test-model",
  client: () => ({ messages: { create: createMock } }),
}));

import { generateBotReply, type BotTools } from "@/lib/whatsapp/bot/reply";

const baseConfig = { prompt: "Sos el bot.", blockedWords: [] as string[], escalationWords: [] as string[], examples: [] };

function makeTools(): BotTools {
  return { checkAvailability: vi.fn(), getMyReservations: vi.fn() };
}

function textOnly(text: string) {
  return { content: [{ type: "text", text }] };
}
function toolUse(name: string, input: unknown, id = "tool1") {
  return { content: [{ type: "tool_use", id, name, input }] };
}

beforeEach(() => {
  createMock.mockReset();
});

describe("generateBotReply", () => {
  // Regresión: con tool_choice "auto" y "respond" en la misma lista que las
  // tools de datos, el modelo podía resolver con texto plano sin llamar
  // ninguna tool — el bot escalaba SIEMPRE (bug real de producción). La fase
  // de consulta nunca debe ofrecer "respond"; la respuesta final se genera
  // en una llamada aparte, forzada.
  it("responde aunque el modelo no pida ninguna tool de datos en la fase de consulta", async () => {
    createMock
      .mockResolvedValueOnce(textOnly("no hace falta consultar nada"))
      .mockResolvedValueOnce(toolUse("respond", { reply: "¡Hola! ¿En qué te ayudo?", escalate: false }));

    const result = await generateBotReply({
      config: baseConfig,
      knowledgeBlock: null,
      contextLine: "contexto",
      transcript: [{ role: "user", content: "Hola" }],
      tools: makeTools(),
    });

    expect(result).toEqual({ reply: "¡Hola! ¿En qué te ayudo?", escalate: false, escalateReason: null, escalateTrigger: null });
    expect(createMock).toHaveBeenCalledTimes(2);
    const gatherCallTools = createMock.mock.calls[0][0].tools.map((t: { name: string }) => t.name);
    expect(gatherCallTools).not.toContain("respond");
    const finalCallTools = createMock.mock.calls[1][0].tools.map((t: { name: string }) => t.name);
    expect(finalCallTools).toEqual(["respond"]);
  });

  it("consulta check_availability antes de responder, cuando el modelo lo pide", async () => {
    const tools = makeTools();
    vi.mocked(tools.checkAvailability).mockResolvedValue({ ok: true, available: [{ label: "Fiat Cronos", dailyRate: 80000 }], truncated: false });

    createMock
      .mockResolvedValueOnce(toolUse("check_availability", { startDate: "2026-09-10", endDate: "2026-09-12" }))
      .mockResolvedValueOnce(textOnly("ya tengo lo que necesito"))
      .mockResolvedValueOnce(toolUse("respond", { reply: "Tenemos el Cronos libre esas fechas.", escalate: false }));

    const result = await generateBotReply({
      config: baseConfig,
      knowledgeBlock: null,
      contextLine: "contexto",
      transcript: [{ role: "user", content: "¿Tienen algo libre del 10 al 12 de septiembre?" }],
      tools,
    });

    expect(result.reply).toBe("Tenemos el Cronos libre esas fechas.");
    expect(result.escalate).toBe(false);
    expect(tools.checkAvailability).toHaveBeenCalledWith({ startDate: "2026-09-10", endDate: "2026-09-12" });
    expect(createMock).toHaveBeenCalledTimes(3);
  });

  it("escala cuando el modelo marca escalate=true en la respuesta final", async () => {
    createMock.mockResolvedValueOnce(textOnly("nada que consultar")).mockResolvedValueOnce(
      toolUse("respond", { reply: "", escalate: true, escalateReason: "Pidió hablar con una persona." }),
    );

    const result = await generateBotReply({
      config: baseConfig,
      knowledgeBlock: null,
      contextLine: "contexto",
      transcript: [{ role: "user", content: "Quiero hablar con alguien" }],
      tools: makeTools(),
    });

    expect(result.escalate).toBe(true);
    expect(result.escalateTrigger).toBe("confidence");
    expect(result.escalateReason).toBe("Pidió hablar con una persona.");
  });
});
