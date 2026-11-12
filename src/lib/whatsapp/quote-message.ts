/**
 * Mensaje de WhatsApp para un presupuesto del Calendario (`RentalQuote`).
 * Puro y sin `server-only` a propósito (mismo criterio que
 * `src/lib/quote-estimate.ts`): la plantilla se resuelve acá, pero quien la
 * manda (`src/app/(app)/calendar/quote-whatsapp-actions.ts`) junta los datos.
 */

export type QuoteMessageVars = {
  auto: string;
  dias: string;
  /** Con descuentos por medio de pago, todas las opciones en una línea
   *  ("$ X con Transferencia (−5 %) · $ Y con otros medios de pago"). */
  precioDia: string;
  total: string;
  /** Bloque con precio por día y total, una línea por forma de pago (ver
   *  `formatPriceOptionsBlock`); sin descuentos, las dos líneas de siempre. */
  precios: string;
  condiciones: string;
  cliente: string;
};

export const DEFAULT_QUOTE_MESSAGE_TEMPLATE = `¡Hola{cliente}! Te paso la propuesta para *{auto}*:

📅 {dias} día(s)
{precios}

{condiciones}

Cualquier duda, quedo atento. ¡Saludos!`;

/** Placeholders disponibles, para mostrar como ayuda en Configuración → WhatsApp. */
export const QUOTE_MESSAGE_PLACEHOLDERS: ReadonlyArray<keyof QuoteMessageVars> = [
  "auto",
  "dias",
  "precios",
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
