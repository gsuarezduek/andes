"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { runCompetitorPriceCheck } from "@/lib/competitor-prices/engine";
import { ADAPTER_KEYS } from "@/lib/competitor-prices/adapters";

/** Botón "Actualizar precios ahora" (mirror de `triggerSyncForm` en /sync) — el feedback sale de `CompetitorCheckRun`, ya recargado por `revalidatePath`. */
export async function triggerCompetitorPriceCheck(): Promise<void> {
  await requireAdmin();
  await runCompetitorPriceCheck("manual");
  revalidatePath("/competitor-prices");
}

export async function createCompetitor(formData: FormData): Promise<void> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const adapterKey = String(formData.get("adapterKey") ?? "").trim();
  if (!name || !url || !ADAPTER_KEYS.includes(adapterKey)) return;

  await prisma.competitor.create({ data: { name, url, adapterKey } });
  revalidatePath("/competitor-prices/competitors");
}

export async function toggleCompetitorActive(id: string): Promise<void> {
  await requireAdmin();
  const competitor = await prisma.competitor.findUnique({ where: { id }, select: { active: true } });
  if (!competitor) return;
  await prisma.competitor.update({ where: { id }, data: { active: !competitor.active } });
  revalidatePath("/competitor-prices/competitors");
  revalidatePath("/competitor-prices");
}

/**
 * Borra un competidor y todo su historial (mappings, checks, precio
 * actual) — a diferencia de "Desactivar", esto no se puede deshacer. Pensado
 * para limpiar un competidor cargado por error o con datos de prueba (ej.
 * adaptador `mock`), no para el uso normal (ahí alcanza con desactivar). Sin
 * `onDelete: Cascade` en el schema (a propósito: un `delete` accidental de
 * un competidor con datos reales no debería poder tirar abajo su historial
 * sin pasar por acá), así que se borra a mano en el orden correcto dentro de
 * una transacción.
 */
export async function deleteCompetitor(id: string): Promise<void> {
  await requireAdmin();
  await prisma.$transaction([
    prisma.competitorCurrentPrice.deleteMany({ where: { competitorId: id } }),
    prisma.competitorPriceCheck.deleteMany({ where: { competitorId: id } }),
    prisma.competitorCategoryMapping.deleteMany({ where: { competitorId: id } }),
    prisma.competitor.delete({ where: { id } }),
  ]);
  revalidatePath("/competitor-prices/competitors");
  revalidatePath("/competitor-prices/categories");
  revalidatePath("/competitor-prices");
}

/** Confirma (o corrige) a mano la categoría de un rótulo crudo de competidor — recién ahí cuenta para la tabla comparativa. */
export async function confirmCategoryMapping(mappingId: string, formData: FormData): Promise<void> {
  await requireAdmin();
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  if (!categoryId) return;
  await prisma.competitorCategoryMapping.update({ where: { id: mappingId }, data: { categoryId } });
  revalidatePath("/competitor-prices/categories");
  revalidatePath("/competitor-prices");
}

export async function createCompetitorCategory(formData: FormData): Promise<void> {
  await requireAdmin();
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return;
  const last = await prisma.competitorCategory.findFirst({ orderBy: { ordering: "desc" } });
  await prisma.competitorCategory.create({ data: { label, ordering: (last?.ordering ?? 0) + 1 } });
  revalidatePath("/competitor-prices/categories");
}
