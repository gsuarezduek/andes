/**
 * Líneas legibles de las condiciones económicas generales (Configuración →
 * Condiciones) — compartidas entre el prompt del bot de WhatsApp
 * (`src/lib/whatsapp/bot/prompt.ts`) y el mensaje de presupuesto del
 * Calendario (`src/lib/whatsapp/quote-message.ts`). Puro y sin `server-only`
 * a propósito, mismo criterio que `src/lib/quote-estimate.ts`.
 */

export type GeneralConditions = {
  kmPerDay: number | null;
  extraKmRate: number | null;
  deductible: number | null;
  deductibleReduced: number | null;
};

export function buildConditionLines(conditions: GeneralConditions | null): string[] {
  if (!conditions) return [];
  const lines: string[] = [];
  if (conditions.kmPerDay != null) lines.push(`Km incluidos por día: ${conditions.kmPerDay} km.`);
  if (conditions.extraKmRate != null) lines.push(`Km extra: $${conditions.extraKmRate} por km.`);
  if (conditions.deductible != null) lines.push(`Franquicia del seguro: $${conditions.deductible}.`);
  if (conditions.deductibleReduced != null) {
    lines.push(`Franquicia reducida con "mejora de seguro": $${conditions.deductibleReduced}.`);
  }
  return lines;
}
