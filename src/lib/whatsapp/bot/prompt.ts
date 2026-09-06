/**
 * Arma el bloque de `system` estático (cacheable — idéntico entre mensajes
 * mientras no cambie la config) del bot: personalidad + instrucciones de
 * confianza/escalamiento + reglas de seguridad + ejemplos + base de
 * conocimiento. El contexto puntual del cliente (nombre, alquiler) va
 * aparte, sin cache — ver reply.ts.
 */

export const CONFIDENCE_INSTRUCTIONS = `Si no estás seguro de la respuesta, si el pedido excede lo que podés resolver por WhatsApp, o si el cliente pide explícitamente hablar con una persona, no inventes una respuesta: marcá escalate=true con un motivo breve en escalateReason. Es preferible derivar a que el cliente reciba información incorrecta.`;

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
}): string {
  const blocks = [
    input.prompt.trim() || "Sos el asistente de WhatsApp de una rentadora de autos. Respondé breve y amable.",
    CONFIDENCE_INSTRUCTIONS,
    buildSecurityBlock(input.blockedWords, input.escalationWords),
    buildExamplesBlock(input.examples),
    input.knowledgeBlock ? `Información de referencia del negocio:\n\n${input.knowledgeBlock}` : null,
  ].filter((b): b is string => Boolean(b));
  return blocks.join("\n\n");
}
