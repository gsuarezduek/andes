/**
 * Salvaguarda anti-alucinación para el LLM en el pipeline de precios de
 * competencia: el LLM nunca devuelve un número parseado, solo CITA el
 * precio tal cual aparece en el texto (ej. "$150.000"). Acá se verifica que
 * esa cita aparezca literal en el texto crudo antes de confiar en ella —
 * recién ahí un parser determinístico (nunca el LLM) la convierte a número.
 *
 * Sin esto, pedirle al LLM un número ya parseado y compararlo contra el
 * texto crudo argentino ("150.000", con punto de miles) NUNCA matchea — el
 * grounding fallaría siempre, aunque el precio extraído fuera correcto.
 */

export type LlmCitation = {
  /** Precio citado tal cual aparece en el texto (ej. "$150.000"). */
  priceText: string;
  currency: "ars" | "usd";
  /** Rótulo del vehículo citado tal cual aparece (ej. "Chevrolet Onix o similar"). */
  vehicleLabel: string;
};

export type GroundedPrice = { price: number; currency: "ars" | "usd" };

/**
 * ¿La cita del LLM aparece literal en el texto crudo? Se chequea el precio
 * Y el vehículo — un precio real adjudicado al auto equivocado en la
 * página sigue siendo un dato falso.
 */
export function isGrounded(citation: LlmCitation, rawText: string): boolean {
  return rawText.includes(citation.priceText) && rawText.includes(citation.vehicleLabel);
}

/**
 * Convierte un string de precio citado a número. Nunca lo toca el LLM — es
 * puro parseo determinístico, testeado con fixtures. Devuelve `null` si no
 * matchea un patrón de precio reconocible.
 */
export function parsePriceText(priceText: string, currency: "ars" | "usd" = "ars"): number | null {
  const digitsOnly = priceText.trim().replace(/[^\d.,]/g, "");
  if (!digitsOnly) return null;

  const normalized =
    currency === "usd"
      ? digitsOnly.replace(/,/g, "") // convención US: "," = miles, "." = decimales
      : digitsOnly.includes(",")
        ? digitsOnly.replace(/\./g, "").replace(",", ".") // convención AR: "." = miles, "," = decimales
        : digitsOnly.replace(/\./g, "");

  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Resuelve una cita del LLM a un precio numérico verificado — `null` si no
 * pasa el chequeo de grounding o el texto citado no es un precio parseable.
 * Este es el único punto de entrada que debería usar el resto del pipeline
 * (nunca leer `priceText`/parsear a mano en otro lado).
 */
export function resolveGroundedPrice(citation: LlmCitation, rawText: string): GroundedPrice | null {
  if (!isGrounded(citation, rawText)) return null;
  const price = parsePriceText(citation.priceText, citation.currency);
  if (price == null) return null;
  return { price, currency: citation.currency };
}
