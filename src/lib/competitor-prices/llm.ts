import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import type { LlmCitation } from "./grounding";

// Haiku alcanza y sale barato para clasificación/extracción acotada — no
// hace falta un modelo más grande para "¿a qué categoría se parece este
// rótulo?" o "citame el precio tal cual aparece en este texto".
const MODEL = "claude-haiku-4-5-20251001";

function client(): Anthropic {
  return new Anthropic({ apiKey: env.llm.apiKey });
}

/**
 * Sugiere la categoría interna más parecida a un `rawLabel` nuevo visto en
 * un competidor (ej. "Corolla Sedan" → categoría "Intermedio"). Es
 * clasificación, no invención de un precio — bajo riesgo por diseño. Aun
 * así, el resultado queda como SUGERENCIA: la cola de revisión humana la
 * confirma antes de que cuente para la tabla comparativa (ver
 * CompetitorCategoryMapping en el schema).
 */
export async function suggestCategory(
  rawLabel: string,
  categories: { id: string; label: string }[],
): Promise<string | null> {
  if (categories.length === 0) return null;
  const msg = await client().messages.create({
    model: MODEL,
    max_tokens: 200,
    tools: [
      {
        name: "suggest_category",
        description:
          "Elige la categoría interna más parecida al rótulo de vehículo de un competidor, o null si ninguna aplica razonablemente.",
        input_schema: {
          type: "object",
          properties: {
            categoryId: {
              type: ["string", "null"],
              description: "id de la categoría elegida, o null si ninguna es razonable",
            },
          },
          required: ["categoryId"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "suggest_category" },
    messages: [
      {
        role: "user",
        content: `Rótulo de vehículo visto en un competidor: "${rawLabel}"\n\nCategorías internas disponibles:\n${categories
          .map((c) => `- ${c.id}: ${c.label}`)
          .join("\n")}\n\nElegí la más parecida (o null si ninguna aplica razonablemente).`,
      },
    ],
  });

  const toolUse = msg.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") return null;
  const input = toolUse.input as { categoryId: string | null };
  return input.categoryId ?? null;
}

/**
 * Fallback de extracción: cuando el parser por selectores de un adaptador no
 * encuentra un precio con confianza, se le pasa el texto del contenedor de
 * resultados al LLM. Devuelve una CITA (nunca un número parseado) — el
 * llamador tiene que pasarla por `resolveGroundedPrice` (grounding.ts) antes
 * de confiar en ella. `null` si el LLM no encontró nada claro.
 */
export async function extractPriceCitation(rawText: string): Promise<LlmCitation | null> {
  const msg = await client().messages.create({
    model: MODEL,
    max_tokens: 300,
    tools: [
      {
        name: "extract_price",
        description:
          "Extrae el precio y el vehículo de un texto de resultados de alquiler de auto, citando AMBOS tal cual aparecen literalmente (mismo formato, mismos símbolos, sin reformatear ni convertir). Si no hay un precio claro, found=false.",
        input_schema: {
          type: "object",
          properties: {
            found: { type: "boolean" },
            priceText: {
              type: "string",
              description: 'El precio citado EXACTAMENTE como aparece en el texto (ej. "$150.000"). Nunca reformatees.',
            },
            currency: { type: "string", enum: ["ars", "usd"] },
            vehicleLabel: {
              type: "string",
              description: "El nombre del vehículo citado EXACTAMENTE como aparece en el texto.",
            },
          },
          required: ["found"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "extract_price" },
    messages: [
      {
        role: "user",
        // Recortado: cota el costo/riesgo y ya alcanza para el contenedor de
        // resultados de una búsqueda puntual.
        content: `Texto extraído de una página de resultados de alquiler de auto:\n\n"""\n${rawText.slice(
          0,
          4000,
        )}\n"""\n\nExtraé el precio y el vehículo, citando AMBOS EXACTAMENTE como aparecen en el texto (mismo formato, mismos símbolos). Si no hay un precio claro, found=false.`,
      },
    ],
  });

  const toolUse = msg.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") return null;
  const input = toolUse.input as {
    found: boolean;
    priceText?: string;
    currency?: "ars" | "usd";
    vehicleLabel?: string;
  };
  if (!input.found || !input.priceText || !input.vehicleLabel) return null;
  return { priceText: input.priceText, currency: input.currency ?? "ars", vehicleLabel: input.vehicleLabel };
}
