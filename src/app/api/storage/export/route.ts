import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth-helpers";
import { displayName } from "@/lib/user-display";
import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage";
import { buildCleanupPlan, planHash } from "@/lib/storage-cleanup";
import { parseCategories, parseDateRange, splitIntoParts } from "@/lib/storage-cleanup-rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Descarga en ZIP (por partes de ~250 MB) de un conjunto de archivos de la
 * nube (admin). `mode=export` baja todo lo que haya en el rango; `mode=delete`
 * baja EXACTAMENTE lo que después se podría eliminar — y solo una descarga
 * completa de ese conjunto habilita la eliminación (ver `startCleanupRun`).
 *
 * ?mode=export|delete&from=YYYY-MM-DD&to=YYYY-MM-DD&categories=a,b&part=1
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const q = req.nextUrl.searchParams;
  const mode = q.get("mode") === "delete" ? "delete" : "export";
  const range = parseDateRange(q.get("from") ?? "", q.get("to") ?? "");
  if ("error" in range) return NextResponse.json({ error: range.error }, { status: 400 });
  const categories = parseCategories((q.get("categories") ?? "").split(",").filter(Boolean), mode);
  if (categories.length === 0) return NextResponse.json({ error: "Elegí al menos una categoría." }, { status: 400 });
  const part = Number(q.get("part") ?? "1");

  const plan = await buildCleanupPlan({ action: mode, categories, range });
  const parts = splitIntoParts(plan.items);
  if (!Number.isInteger(part) || part < 1 || part > parts.length) {
    return NextResponse.json({ error: "No hay archivos para descargar (o la parte no existe)." }, { status: 404 });
  }
  const items = parts[part - 1]!;

  const record = await prisma.storageExport.create({
    data: {
      planHash: planHash(plan.items),
      part,
      parts: parts.length,
      createdById: user.id ?? null,
      createdByName: displayName(user),
    },
    select: { id: true },
  });

  const { Zip, ZipPassThrough } = await import("fflate");
  const errors: string[] = [];
  let index = 0;
  let emitted = 0;
  let finalized = false;
  let zip: InstanceType<typeof Zip>;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      zip = new Zip((err, chunk, final) => {
        if (err) {
          controller.error(err);
          return;
        }
        emitted++;
        controller.enqueue(chunk);
        if (final) controller.close();
      });
    },
    // Una llamada a `pull` tiene que terminar emitiendo datos (o cerrando el
    // stream): si un archivo falla y no se emite nada, el stream se traba.
    // Por eso se sigue con el siguiente archivo hasta que salga algo.
    async pull() {
      const before = emitted;
      while (emitted === before && index < items.length) {
        const item = items[index++]!;
        try {
          const { body } = await storage().get(item.key);
          const file = new ZipPassThrough(item.zipPath); // fotos/PDF/video ya vienen comprimidos: sin recomprimir
          zip.add(file);
          file.push(new Uint8Array(body), true);
        } catch (e) {
          errors.push(`${item.zipPath} (${item.key}): ${e instanceof Error ? e.message : "error"}`);
        }
      }
      if (emitted === before && index >= items.length && !finalized) {
        finalized = true;
        if (errors.length > 0) {
          const file = new ZipPassThrough("ERRORES.txt");
          zip.add(file);
          file.push(new TextEncoder().encode(`Estos archivos no se pudieron leer y NO están en el ZIP:\n\n${errors.join("\n")}\n`), true);
        } else {
          // Solo cuenta como respaldo válido si se leyeron todos los archivos de la parte.
          await prisma.storageExport.update({ where: { id: record.id }, data: { completedAt: new Date() } });
        }
        zip.end();
      }
    },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="andes-${mode === "delete" ? "respaldo" : "archivos"}-${stamp}-parte-${part}-de-${parts.length}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
