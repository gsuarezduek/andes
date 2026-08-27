import "server-only";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import type { Competitor, CompetitorPriceStatus } from "@prisma/client";
import { getCompetitorPriceSettings, resolveOffsetsToWindows } from "./settings";
import { getAdapter } from "./adapters";
import { suggestCategory, extractPriceCitation } from "./llm";
import { resolveGroundedPrice } from "./grounding";
import { startRun, finishRun, buildRunMessage, errMsg, hasRunInProgress } from "./log";
import type { CompetitorPriceAdapter, PriceCheckWindow, RawPriceItem } from "./types";

export type CompetitorRunResultSummary = {
  result: "success" | "partial" | "error";
  competitorsChecked: number;
  pricesFound: number;
  errors: number;
  message: string;
};

type ResolvedItem = {
  rawLabel: string;
  categoryId: string | null;
  price: number | null;
  currency: "ars" | "usd" | null;
  status: CompetitorPriceStatus;
  llmCitation: string | null;
  sourceUrl: string;
};

/**
 * Elige, por categoría, el ítem más barato entre los resueltos en una
 * ventana — varios autos de un competidor pueden mapear a la misma
 * categoría interna, y nos interesa "cuánto pagaría por un SUV ahí" (el
 * mínimo). Pura y testeable, separada de la orquestación con DB. Genérica
 * para poder testearla con objetos simples y usarla en el motor con el
 * `checkId` ya adjunto (ver `checkWindow`).
 */
export function pickCheapestPerCategory<T extends { categoryId: string | null; price: number | null }>(
  items: T[],
): Map<string, T> {
  const best = new Map<string, T>();
  for (const item of items) {
    if (item.categoryId == null || item.price == null) continue;
    const current = best.get(item.categoryId);
    if (!current || item.price < (current.price as number)) {
      best.set(item.categoryId, item);
    }
  }
  return best;
}

/**
 * Motor de precios de la competencia. Mirror de `runBookingSync`
 * (src/lib/sync/engine.ts): ventanas de fecha resueltas desde settings,
 * tolerante a errores por ítem (no aborta toda la corrida), siempre registra
 * un `CompetitorCheckRun`. Secuencial entre competidores para acotar la
 * memoria pico de varios Chromium headless a la vez en el mismo contenedor
 * que sirve el wizard de entrega/devolución (prioridad #1 del proyecto).
 */
export async function runCompetitorPriceCheck(
  triggeredBy: "manual" | "cron" = "manual",
): Promise<CompetitorRunResultSummary> {
  if (await hasRunInProgress()) {
    return {
      result: "error",
      competitorsChecked: 0,
      pricesFound: 0,
      errors: 0,
      message: "Ya hay una corrida en curso — no se arrancó una nueva.",
    };
  }

  const runId = await startRun(triggeredBy);

  const [competitors, categories, settings] = await Promise.all([
    prisma.competitor.findMany({ where: { active: true } }),
    prisma.competitorCategory.findMany({ select: { id: true, label: true } }),
    getCompetitorPriceSettings(),
  ]);
  const windows = resolveOffsetsToWindows(settings.offsetsDays, settings.rentalDurationDays, new Date());

  let competitorsChecked = 0;
  let pricesFound = 0;
  let errors = 0;
  const problems: string[] = [];

  for (const competitor of competitors) {
    let adapter: CompetitorPriceAdapter;
    try {
      adapter = getAdapter(competitor.adapterKey);
    } catch (e) {
      errors++;
      problems.push(`${competitor.name}: ${errMsg(e)}`);
      continue;
    }
    competitorsChecked++;

    for (const window of windows) {
      try {
        pricesFound += await checkWindow(competitor, adapter, window, categories, runId);
      } catch (e) {
        errors++;
        problems.push(`${competitor.name} / +${window.offsetDays}d: ${errMsg(e)}`);
      }
    }
  }

  const result = errors === 0 ? "success" : pricesFound > 0 ? "partial" : "error";
  const message = buildRunMessage({ competitorsChecked, pricesFound, errors, problems });
  await finishRun(runId, result, competitorsChecked, pricesFound, errors, message);
  return { result, competitorsChecked, pricesFound, errors, message };
}

/** Una búsqueda (competidor × ventana de fecha) → todos los autos devueltos, categorizados y con precio resuelto. Devuelve cuántas categorías quedaron con precio actualizado. */
async function checkWindow(
  competitor: Competitor,
  adapter: CompetitorPriceAdapter,
  window: PriceCheckWindow,
  categories: { id: string; label: string }[],
  runId: string,
): Promise<number> {
  const raw = await adapter.fetchPrices({ competitor, window });

  if (raw.status === "unavailable") {
    await prisma.competitorPriceCheck.create({
      data: {
        competitorId: competitor.id,
        runId,
        checkedAt: new Date(),
        pickupDate: window.pickupDate,
        returnDate: window.returnDate,
        days: window.days,
        status: "unavailable",
        errorReason: raw.reason,
      },
    });
    return 0;
  }

  const resolved: ResolvedItem[] = [];
  for (const item of raw.items) {
    const categoryId = await resolveCategoryMapping(competitor.id, item.rawLabel, categories);
    const price = await resolveItemPrice(item);
    resolved.push({
      rawLabel: item.rawLabel,
      categoryId,
      price: price?.price ?? null,
      currency: price?.currency ?? null,
      status: price ? "auto_found" : "needs_review",
      llmCitation: price?.citationJson ?? null,
      sourceUrl: item.sourceUrl,
    });
  }

  // Log histórico completo: una fila por ítem devuelto, sin importar si
  // terminó siendo el más barato de su categoría o no.
  const created: (ResolvedItem & { checkId: string })[] = [];
  for (const r of resolved) {
    const row = await prisma.competitorPriceCheck.create({
      data: {
        competitorId: competitor.id,
        categoryId: r.categoryId,
        rawLabel: r.rawLabel,
        price: r.price,
        currency: r.currency,
        checkedAt: new Date(),
        pickupDate: window.pickupDate,
        returnDate: window.returnDate,
        days: window.days,
        sourceUrl: r.sourceUrl,
        status: r.status,
        llmCitation: r.llmCitation,
        runId,
      },
    });
    created.push({ ...r, checkId: row.id });
  }

  // "Precio actual" solo se pisa con el más barato por categoría de esta
  // ventana. Si ninguna quedó resuelta para una categoría, su
  // CompetitorCurrentPrice simplemente no se toca (nunca se borra el
  // último precio válido).
  const cheapest = pickCheapestPerCategory(created);
  for (const [categoryId, best] of cheapest) {
    await prisma.competitorCurrentPrice.upsert({
      where: {
        competitorId_categoryId_pickupOffsetDays: {
          competitorId: competitor.id,
          categoryId,
          pickupOffsetDays: window.offsetDays,
        },
      },
      create: {
        competitorId: competitor.id,
        categoryId,
        pickupOffsetDays: window.offsetDays,
        priceCheckId: best.checkId,
        lastCheckedAt: new Date(),
      },
      update: { priceCheckId: best.checkId, lastCheckedAt: new Date() },
    });
  }

  return cheapest.size;
}

/** Resuelve el precio de un ítem: selectores primero (si el adaptador trajo un candidato), LLM de respaldo después. Ambos caminos pasan por el chequeo de grounding — nunca se confía en un precio no verificado contra el texto crudo. */
async function resolveItemPrice(
  item: RawPriceItem,
): Promise<{ price: number; currency: "ars" | "usd"; citationJson: string | null } | null> {
  if (item.priceCandidate) {
    const grounded = resolveGroundedPrice(
      { priceText: item.priceCandidate.priceText, currency: item.priceCandidate.currency, vehicleLabel: item.rawLabel },
      item.rawText,
    );
    if (grounded) return { ...grounded, citationJson: null };
  }

  if (env.hasLlm) {
    try {
      const citation = await extractPriceCitation(item.rawText);
      if (citation) {
        const grounded = resolveGroundedPrice(citation, item.rawText);
        if (grounded) return { ...grounded, citationJson: JSON.stringify(citation) };
      }
    } catch {
      // best-effort: si el LLM falla, el ítem queda needs_review.
    }
  }

  return null;
}

/** Resuelve la categoría interna de un `rawLabel`. Si es nuevo, pide una sugerencia al LLM (best-effort) y crea la fila pendiente de confirmación — la sugerencia NUNCA se usa sola, solo cuenta una vez que un humano la confirma en la cola de revisión. */
async function resolveCategoryMapping(
  competitorId: string,
  rawLabel: string,
  categories: { id: string; label: string }[],
): Promise<string | null> {
  const existing = await prisma.competitorCategoryMapping.findUnique({
    where: { competitorId_rawLabel: { competitorId, rawLabel } },
  });
  if (existing) return existing.categoryId;

  let suggestedCategoryId: string | null = null;
  if (env.hasLlm) {
    try {
      suggestedCategoryId = await suggestCategory(rawLabel, categories);
    } catch {
      suggestedCategoryId = null;
    }
  }
  await prisma.competitorCategoryMapping.create({
    data: { competitorId, rawLabel, suggestedCategoryId },
  });
  return null;
}
