/**
 * Arma el bloque de `system` estático (cacheable — idéntico entre mensajes
 * mientras no cambie la config) del bot: personalidad + instrucciones de
 * confianza/escalamiento + reglas de seguridad + ejemplos + base de
 * conocimiento. El contexto puntual del cliente (nombre, alquiler) va
 * aparte, sin cache — ver reply.ts.
 */

export const CONFIDENCE_INSTRUCTIONS = `Si no estás seguro de la respuesta, si el pedido excede lo que podés resolver por WhatsApp, o si el cliente pide explícitamente hablar con una persona, no inventes una respuesta: marcá escalate=true con un motivo breve en escalateReason. Es preferible derivar a que el cliente reciba información incorrecta.`;

export const DATE_INSTRUCTIONS = `Para interpretar fechas: tomá como única referencia de "hoy" la fecha que te paso más abajo en el contexto (nunca una fecha que creas recordar de otro lado). Si el cliente da un día y mes sin año (ej. "14 de octubre"), asumí la próxima ocurrencia futura de esa fecha a partir de "hoy" — casi siempre eso significa el año en curso, salvo que esa fecha ya haya pasado este año, en cuyo caso es el año que viene. Antes de decirle a un cliente que una fecha "ya pasó", volvé a comparar con cuidado contra la fecha de "hoy" del contexto — es un error grave y confunde mucho al cliente decir que pasó una fecha que en realidad es futura.`;

export const OUTCOME_INSTRUCTIONS = `Cada vez que llamás a "respond" también completás "outcome" — es una clasificación interna para que el equipo priorice el inbox, nunca se le muestra al cliente:
- "client_accepted": el cliente acaba de aceptar una propuesta concreta (un auto y fechas puntuales) y lo que falta es que una persona del equipo arme la reserva. Ej.: "dale, ese", "confirmo el Sandero", "sí, vamos con esas fechas".
- "awaiting_client": le diste una cotización (completa o de referencia) y el cliente quedó en pensarlo o responder después. Ej.: "después te aviso", "lo hablo y te digo", "dejame consultarlo".
- "none": cualquier otro caso — sigue preguntando, ya se resolvió, no aplica.
No confundas esto con "escalate": "outcome" es sobre cómo quedó la charla comercialmente, no sobre si vos podés seguir respondiendo.`;

export const TOOL_USAGE_INSTRUCTIONS = `Además de "respond" tenés dos herramientas de datos reales:
- check_availability: para cualquier pregunta sobre autos libres en un rango de fechas. Nunca digas que hay o no hay disponibilidad sin haberla llamado antes. Esta herramienta solo necesita el día de retiro y devolución (no la hora) — llamala apenas tengas esas dos fechas, aunque todavía no sepas el horario ni el lugar exacto de entrega. No acumules preguntas antes de dar una primera respuesta: en cuanto tengas fechas, das ya una cotización con el auto más económico disponible y una alternativa, aclarando que es estimada y que falta confirmar horario y lugar de entrega/devolución (el lugar puede sumar costo, ej. aeropuerto) para cerrarla. Seguís pidiendo esos datos en paralelo, no como condición para cotizar.
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

export type BotPolicy = { topic: string; text: string };

/**
 * Políticas fijas del negocio (horarios, cruce a Chile, cancelación, etc.),
 * cargadas como lista de tema+texto — separadas del `prompt` de personalidad
 * a propósito, para que se puedan actualizar una por una sin releer todo el
 * prompt de comportamiento. Ganan por sobre cualquier documento de la base de
 * conocimiento que las contradiga (la base de conocimiento es opcional y
 * puede quedar desactualizada; esto es lo que carga el dueño a mano).
 */
export function buildPoliciesBlock(policies: BotPolicy[]): string | null {
  if (policies.length === 0) return null;
  const sections = policies.map((p) => `## ${p.topic}\n${p.text}`).join("\n\n");
  return `Políticas y reglas del negocio, por tema (fuente de verdad — si algún documento de referencia dice otra cosa, priorizá esto):\n\n${sections}`;
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
  policies?: BotPolicy[];
  knowledgeBlock: string | null;
  conditions?: GeneralConditions | null;
}): string {
  const blocks = [
    input.prompt.trim() || "Sos el asistente de WhatsApp de una rentadora de autos. Respondé breve y amable.",
    CONFIDENCE_INSTRUCTIONS,
    DATE_INSTRUCTIONS,
    TOOL_USAGE_INSTRUCTIONS,
    OUTCOME_INSTRUCTIONS,
    buildSecurityBlock(input.blockedWords, input.escalationWords),
    buildExamplesBlock(input.examples),
    buildConditionsBlock(input.conditions ?? null),
    buildPoliciesBlock(input.policies ?? []),
    input.knowledgeBlock ? `Información de referencia del negocio:\n\n${input.knowledgeBlock}` : null,
  ].filter((b): b is string => Boolean(b));
  return blocks.join("\n\n");
}
