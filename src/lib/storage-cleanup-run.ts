/**
 * Ejecución de una corrida de limpieza (eliminar o comprimir) por tandas.
 *
 * Al iniciar se congela el plan en `StorageCleanupRun.plan` y `doneCount` hace
 * de cursor. Cada tanda reclama su tramo antes de procesarlo (update
 * condicional sobre `doneCount`), así dos pestañas o un reintento no procesan
 * dos veces lo mismo, y una corrida cortada a la mitad se retoma donde quedó.
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage";
import {
  buildCleanupPlan,
  planHash,
  type PlanItem,
} from "@/lib/storage-cleanup";
import {
  splitIntoParts,
  type CleanupCategory,
  type DateRange,
} from "@/lib/storage-cleanup-rules";
import { compressPdfImages, compressPhoto, compressSignature, type Compressed } from "@/lib/file-compress";

export type Actor = { id: string; name: string };

type StoredPlanItem = Pick<PlanItem, "key" | "category" | "size">;

/** Tamaño de cada tanda: borrar es liviano; comprimir baja y sube cada archivo. */
const BATCH_SIZE: Record<"delete" | "compress", number> = { delete: 100, compress: 8 };

export type RunProgress = {
  runId: string;
  action: "delete" | "compress";
  fileCount: number;
  doneCount: number;
  changedCount: number;
  bytesFreed: number;
  failed: number;
  completed: boolean;
};

/** ¿Se descargaron hasta el final TODAS las partes de este conjunto exacto de archivos? */
export async function hasCompleteExport(hash: string, parts: number): Promise<boolean> {
  const done = await prisma.storageExport.findMany({
    where: { planHash: hash, completedAt: { not: null } },
    select: { part: true },
  });
  const have = new Set(done.map((d) => d.part));
  for (let p = 1; p <= parts; p++) if (!have.has(p)) return false;
  return true;
}

export async function startCleanupRun(input: {
  action: "delete" | "compress";
  categories: CleanupCategory[];
  range: DateRange;
  actor: Actor;
}): Promise<{ runId: string } | { error: string }> {
  const { action, categories, range, actor } = input;
  const plan = await buildCleanupPlan({ action, categories, range });
  if (plan.items.length === 0) return { error: "No hay archivos para procesar con esos filtros." };

  if (action === "delete") {
    const parts = splitIntoParts(plan.items).length;
    if (!(await hasCompleteExport(planHash(plan.items), parts))) {
      return {
        error: `Antes de eliminar tenés que descargar el respaldo completo (${parts} ${parts === 1 ? "archivo ZIP" : "archivos ZIP"}) de exactamente estos archivos.`,
      };
    }
  }

  const stored: StoredPlanItem[] = plan.items
    .map(({ key, category, size }) => ({ key, category, size }))
    .sort((a, b) => a.key.localeCompare(b.key));

  const run = await prisma.storageCleanupRun.create({
    data: {
      action,
      dateFrom: range.from,
      dateTo: range.toExclusive,
      categories,
      plan: stored,
      fileCount: stored.length,
      createdById: actor.id,
      createdByName: actor.name,
    },
    select: { id: true },
  });
  return { runId: run.id };
}

async function compressItem(item: StoredPlanItem): Promise<{ result: Compressed; before: number } | null> {
  const { body, contentType } = await storage().get(item.key);
  let result: Compressed | null = null;
  if (item.category === "signatures") result = await compressSignature(body);
  else if (item.category === "actas") result = await compressPdfImages(body);
  else if (contentType.startsWith("image/")) result = await compressPhoto(body);
  return result ? { result, before: body.length } : null;
}

export async function processRunBatch(runId: string): Promise<RunProgress | { error: string }> {
  const run = await prisma.storageCleanupRun.findUnique({ where: { id: runId } });
  if (!run) return { error: "No se encontró la corrida." };
  const action = run.action as "delete" | "compress";
  const plan = (run.plan ?? []) as unknown as StoredPlanItem[];

  const progress = (over: Partial<RunProgress> = {}): RunProgress => ({
    runId,
    action,
    fileCount: run.fileCount,
    doneCount: run.doneCount,
    changedCount: run.changedCount,
    bytesFreed: Number(run.bytesFreed),
    failed: 0,
    completed: run.completedAt != null,
    ...over,
  });

  if (run.completedAt || run.doneCount >= run.fileCount) return progress({ completed: true });

  const from = run.doneCount;
  const batch = plan.slice(from, from + BATCH_SIZE[action]);
  const to = from + batch.length;

  // Reclamar el tramo: si otra petición ya lo tomó, no se procesa dos veces.
  const claimed = await prisma.storageCleanupRun.updateMany({
    where: { id: runId, doneCount: from },
    data: { doneCount: to },
  });
  if (claimed.count === 0) {
    const fresh = await prisma.storageCleanupRun.findUnique({ where: { id: runId } });
    return fresh
      ? { runId, action, fileCount: fresh.fileCount, doneCount: fresh.doneCount, changedCount: fresh.changedCount, bytesFreed: Number(fresh.bytesFreed), failed: 0, completed: fresh.completedAt != null }
      : { error: "No se encontró la corrida." };
  }

  let failed = 0;
  let changed = 0;
  let freed = 0;

  if (action === "delete") {
    const deleted: StoredPlanItem[] = [];
    for (const item of batch) {
      try {
        await storage().delete(item.key);
        deleted.push(item);
      } catch (e) {
        failed++;
        console.error(`[storage-cleanup] no se pudo borrar "${item.key}"`, e);
      }
    }
    if (deleted.length > 0) {
      await prisma.$transaction([
        prisma.deletedFile.createMany({
          data: deleted.map((d) => ({ storageKey: d.key, category: d.category, bytes: d.size, runId })),
          skipDuplicates: true,
        }),
        prisma.whatsAppMedia.updateMany({
          where: { storageKey: { in: deleted.map((d) => d.key) } },
          data: { deletedAt: new Date() },
        }),
      ]);
    }
    changed = deleted.length;
    freed = deleted.reduce((sum, d) => sum + d.size, 0);
  } else {
    for (const item of batch) {
      try {
        const out = await compressItem(item);
        if (!out) continue;
        await storage().put(item.key, out.result.body, out.result.contentType);
        if (item.category === "wa_image") {
          await prisma.whatsAppMedia.updateMany({
            where: { storageKey: item.key },
            data: { mimeType: out.result.contentType },
          });
        }
        changed++;
        freed += out.before - out.result.body.length;
      } catch (e) {
        failed++;
        console.error(`[storage-cleanup] no se pudo comprimir "${item.key}"`, e);
      }
    }
  }

  const finished = to >= run.fileCount;
  const updated = await prisma.storageCleanupRun.update({
    where: { id: runId },
    data: {
      changedCount: { increment: changed },
      bytesFreed: { increment: BigInt(freed) },
      ...(finished ? { completedAt: new Date() } : {}),
    },
  });

  return {
    runId,
    action,
    fileCount: updated.fileCount,
    doneCount: updated.doneCount,
    changedCount: updated.changedCount,
    bytesFreed: Number(updated.bytesFreed),
    failed,
    completed: updated.completedAt != null,
  };
}
