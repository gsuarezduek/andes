"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-helpers";
import { displayName } from "@/lib/user-display";
import { prisma } from "@/lib/prisma";
import { buildCleanupPlan, planHash, type CategorySummary } from "@/lib/storage-cleanup";
import { processRunBatch, startCleanupRun, type RunProgress } from "@/lib/storage-cleanup-run";
import {
  parseCategories,
  parseDateRange,
  splitIntoParts,
  type CleanupAction,
} from "@/lib/storage-cleanup-rules";

export type CleanupFilters = { from: string; to: string; categories: string[] };

export type ActionPreview = {
  count: number;
  totalBytes: number;
  byCategory: CategorySummary[];
  notes: string[];
  /** Solo export/delete: cuántas partes de ZIP y cuáles ya se descargaron completas. */
  parts: number;
  downloadedParts: number[];
};

export type PreviewResult =
  | { error: string }
  | { export: ActionPreview; delete: ActionPreview; compress: ActionPreview };

async function previewFor(action: CleanupAction, filters: CleanupFilters): Promise<ActionPreview | { error: string }> {
  const range = parseDateRange(filters.from, filters.to);
  if ("error" in range) return range;
  const categories = parseCategories(filters.categories, action);
  const empty: ActionPreview = { count: 0, totalBytes: 0, byCategory: [], notes: [], parts: 0, downloadedParts: [] };
  if (categories.length === 0) return empty;

  const plan = await buildCleanupPlan({ action, categories, range });
  const parts = splitIntoParts(plan.items).length;
  let downloadedParts: number[] = [];
  if (parts > 0 && action !== "compress") {
    const rows = await prisma.storageExport.findMany({
      where: { planHash: planHash(plan.items), completedAt: { not: null } },
      select: { part: true },
    });
    downloadedParts = [...new Set(rows.map((r) => r.part))].sort((a, b) => a - b);
  }
  return {
    count: plan.items.length,
    totalBytes: plan.totalBytes,
    byCategory: plan.byCategory,
    notes: plan.notes,
    parts,
    downloadedParts,
  };
}

/** Qué archivos hay para cada acción con estos filtros (no toca nada). */
export async function previewCleanup(filters: CleanupFilters): Promise<PreviewResult> {
  await requireAdmin();
  const [exp, del, comp] = await Promise.all([
    previewFor("export", filters),
    previewFor("delete", filters),
    previewFor("compress", filters),
  ]);
  for (const r of [exp, del, comp]) if ("error" in r) return r;
  return { export: exp as ActionPreview, delete: del as ActionPreview, compress: comp as ActionPreview };
}

/** Crea la corrida (congela el plan). Eliminar exige el respaldo completo y escribir ELIMINAR. */
export async function startCleanup(
  action: "delete" | "compress",
  filters: CleanupFilters,
  confirmation: string,
): Promise<{ runId: string } | { error: string }> {
  const user = await requireAdmin();
  if (action === "delete" && confirmation.trim().toUpperCase() !== "ELIMINAR") {
    return { error: "Escribí ELIMINAR para confirmar." };
  }
  const range = parseDateRange(filters.from, filters.to);
  if ("error" in range) return range;
  const categories = parseCategories(filters.categories, action);
  if (categories.length === 0) return { error: "Elegí al menos una categoría." };

  const result = await startCleanupRun({
    action,
    categories,
    range,
    actor: { id: user.id!, name: displayName(user) },
  });
  revalidatePath("/settings/cloud/cleanup");
  return result;
}

/** Procesa la siguiente tanda de una corrida (el panel la llama en bucle hasta terminar). */
export async function runCleanupBatch(runId: string): Promise<RunProgress | { error: string }> {
  await requireAdmin();
  const result = await processRunBatch(runId);
  if (!("error" in result) && result.completed) {
    revalidatePath("/settings/cloud/cleanup");
    revalidatePath("/settings/cloud");
  }
  return result;
}
