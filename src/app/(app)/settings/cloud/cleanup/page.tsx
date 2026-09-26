import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/datetime";
import { ButtonLink } from "@/components/ui/button";
import { CleanupPanel, type RunHistoryRow } from "./cleanup-panel";

export const metadata: Metadata = { title: "Limpiar archivos — Andes" };
export const dynamic = "force-dynamic";

export default async function CleanupPage() {
  await requireAdmin();

  const runs = await prisma.storageCleanupRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 15,
    select: {
      id: true,
      action: true,
      createdAt: true,
      createdByName: true,
      fileCount: true,
      doneCount: true,
      changedCount: true,
      bytesFreed: true,
      completedAt: true,
      categories: true,
    },
  });

  const history: RunHistoryRow[] = runs.map((r) => ({
    id: r.id,
    action: r.action === "delete" ? "delete" : "compress",
    createdAt: formatDateTime(r.createdAt),
    createdByName: r.createdByName,
    fileCount: r.fileCount,
    doneCount: r.doneCount,
    changedCount: r.changedCount,
    bytesFreed: Number(r.bytesFreed),
    completed: r.completedAt != null,
    categories: r.categories,
  }));

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Limpiar archivos</h1>
        <p className="text-sm text-foreground/60">
          Descargá, comprimí o eliminá fotos, videos, documentos y adjuntos de WhatsApp de un rango de fechas para liberar espacio.
        </p>
      </div>
      <CleanupPanel history={history} />
      <div>
        <ButtonLink href="/settings/cloud" variant="secondary">Volver a Nube</ButtonLink>
      </div>
    </div>
  );
}
