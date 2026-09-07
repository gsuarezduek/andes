/**
 * Arma el bloque de `system` estático (cacheable — idéntico entre mensajes
 * mientras no cambie la config) del bot: personalidad + instrucciones de
 * confianza/escalamiento + reglas de seguridad + ejemplos + base de
 * conocimiento. El contexto puntual del cliente (nombre, alquiler) va
 * aparte, sin cache — ver reply.ts.
 */

export const CONFIDENCE_INSTRUCTIONS = `Si no estás seguro de la respuesta, si el pedido excede lo que podés resolver por WhatsApp, o si el cliente pide explícitamente hablar con una persona, no inventes una respuesta: marcá escalate=true con un motivo breve en escalateReason. Es preferible derivar a que el cliente reciba información incorrecta.`;

export const TOOL_USAGE_INSTRUCTIONS = `Además de "respond" tenés dos herramientas de datos reales:
- check_availability: para cualquier pregunta sobre autos libres en un rango de fechas. Nunca digas que hay o no hay disponibilidad sin haberla llamado antes.
- get_my_reservations: para preguntas sobre LA RESERVA DEL CLIENTE QUE TE ESTÁ ESCRIBIENDO (estado, fechas, auto, total, saldo), o si te da un número de reserva. Nunca inventes esos datos ni un precio de una reserva sin haberla llamado antes. Si no encuentra nada con el número que te dieron, decile que no la encontrás asociada a su teléfono y ofrecé derivarlo con una persona — nunca asumas que es de otra persona ni la des por buena igual.
Siempre terminás la respuesta llamando a "respond" con tu mensaje final — nunca respondas en texto plano sin pasar por esa herramienta.`;

export function buildSecurityBlock(blockedWords: string[], escalationWords: string[]): string | null {
  const parts: string[] = [];
  if (blockedWords.length > 0) {
    parts.push(`Nunca menciones ni uses estas palabras/temas en tu respuesta: ${blockedWords.join(", ")}.`);
  }
  if (escalationWords.length > 0) {
    parts.push(
      `Si el cliente menciona algo relacionado a: ${escalationWords.join(", ")} — marcá escalate=true en vez de responder.`,
    );
  }
  return parts.length > 0 ? parts.join(" ") : null;
}

export type GeneralConditions = {
  kmPerDay: number | null;
  extraKmRate: number | null;
  deductible: number | null;
  deductibleReduced: number | null;
};

/**
 * Condiciones económicas generales (Configuración → Condiciones) para que el
 * bot pueda responder preguntas de precio genéricas sin necesitar un tool —
 * son casi estáticas, a diferencia de la reserva puntual de un cliente.
 */
export function buildConditionsBlock(conditions: GeneralConditions | null): string | null {
  if (!conditions) return null;
  const lines: string[] = [];
  if (conditions.kmPerDay != null) lines.push(`Km incluidos por día: ${conditions.kmPerDay} km.`);
  if (conditions.extraKmRate != null) lines.push(`Km extra: $${conditions.extraKmRate} por km.`);
  if (conditions.deductible != null) lines.push(`Franquicia del seguro: $${conditions.deductible}.`);
  if (conditions.deductibleReduced != null) {
    lines.push(`Franquicia reducida con "mejora de seguro": $${conditions.deductibleReduced}.`);
  }
  if (lines.length === 0) return null;
  return `Condiciones económicas generales vigentes (aplican salvo que la reserva puntual del cliente diga otra cosa; la tarifa por día de cada auto sale de check_availability):\n${lines.join("\n")}`;
}

export function buildExamplesBlock(examples: { question: string; answer: string }[]): string | null {
  if (examples.length === 0) return null;
  const lines = examples
    .slice(0, 20)
    .map((e) => `Cliente: ${e.question}\nVos responderías: ${e.answer}`)
    .join("\n\n");
  return `Ejemplos de cómo responder (guían tono y estilo, no son respuestas fijas para copiar literal):\n\n${lines}`;
}

export function buildStaticSystemText(input: {
  prompt: string;
  blockedWords: string[];
  escalationWords: string[];
  examples: { question: string; answer: string }[];
  knowledgeBlock: string | null;
  conditions?: GeneralConditions | null;
}): string {
  const blocks = [
    input.prompt.trim() || "Sos el asistente de WhatsApp de una rentadora de autos. Respondé breve y amable.",
    CONFIDENCE_INSTRUCTIONS,
    TOOL_USAGE_INSTRUCTIONS,
    buildSecurityBlock(input.blockedWords, input.escalationWords),
    buildExamplesBlock(input.examples),
    buildConditionsBlock(input.conditions ?? null),
    input.knowledgeBlock ? `Información de referencia del negocio:\n\n${input.knowledgeBlock}` : null,
  ].filter((b): b is string => Boolean(b));
  return blocks.join("\n\n");
}
