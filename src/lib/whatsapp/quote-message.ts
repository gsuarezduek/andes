/**
 * Mensaje de WhatsApp para un presupuesto del Calendario (`RentalQuote`).
 * Puro y sin `server-only` a propósito (mismo criterio que
 * `src/lib/quote-estimate.ts`): la plantilla se resuelve acá, pero quien la
 * manda (`src/app/(app)/calendar/quote-whatsapp-actions.ts`) junta los datos.
 */

export type QuoteMessageVars = {
  auto: string;
  dias: string;
  precioDia: string;
  total: string;
  condiciones: string;
  cliente: string;
};

export const DEFAULT_QUOTE_MESSAGE_TEMPLATE = `¡Hola{cliente}! Te paso la propuesta para *{auto}*:

📅 {dias} día(s)
💰 Precio por día: {precioDia}
💵 Total: {total}

{condiciones}

Cualquier duda, quedo atento. ¡Saludos!`;

/** Placeholders disponibles, para mostrar como ayuda en Configuración → WhatsApp. */
export const QUOTE_MESSAGE_PLACEHOLDERS: ReadonlyArray<keyof QuoteMessageVars> = [
  "auto",
  "dias",
  "precioDia",
  "total",
  "condiciones",
  "cliente",
];

/** Sustitución simple de `{placeholder}` por su valor — cae a la plantilla default si `template` viene vacío. */
export function renderQuoteMessage(template: string | null, vars: QuoteMessageVars): string {
  const text = template?.trim() || DEFAULT_QUOTE_MESSAGE_TEMPLATE;
  return (Object.keys(vars) as Array<keyof QuoteMessageVars>).reduce(
    (acc, key) => acc.replaceAll(`{${key}}`, vars[key]),
    text,
  );
}
