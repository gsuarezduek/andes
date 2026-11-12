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
  /**
   * Franquicia de las camionetas, para el bot (que habla de toda la flota).
   * Si difiere de la de autos, cada línea de franquicia da los dos valores y
   * nombra los modelos que son camioneta. El mensaje de un presupuesto no la
   * pasa: ahí ya viene la franquicia del auto puntual (`deductiblesFor`).
   */
  truck?: { deductible: number | null; deductibleReduced: number | null; models: string[] };
};

/** "$600000" o, si la de camionetas es otra, "$600000 en autos; $900000 en camionetas (Spin, Amarok)". */
function deductibleText(car: number, truck: number | null | undefined, models: string[] | null): string {
  if (truck == null || truck === car) return `$${car}`;
  const which = models && models.length > 0 ? ` (${models.join(", ")})` : "";
  return `$${car} en autos; $${truck} en camionetas${which}`;
}

export function buildConditionLines(conditions: GeneralConditions | null): string[] {
  if (!conditions) return [];
  const lines: string[] = [];
  if (conditions.kmPerDay != null) lines.push(`Km incluidos por día: ${conditions.kmPerDay} km.`);
  if (conditions.extraKmRate != null) lines.push(`Km extra: $${conditions.extraKmRate} por km.`);
  const truck = conditions.truck;
  if (conditions.deductible != null) {
    lines.push(`Franquicia del seguro: ${deductibleText(conditions.deductible, truck?.deductible, truck?.models ?? null)}.`);
  }
  if (conditions.deductibleReduced != null) {
    // Los modelos ya se nombraron en la línea anterior.
    const models = conditions.deductible != null ? null : (truck?.models ?? null);
    lines.push(
      `Franquicia reducida con "mejora de seguro": ${deductibleText(conditions.deductibleReduced, truck?.deductibleReduced, models)}.`,
    );
  }
  return lines;
}
