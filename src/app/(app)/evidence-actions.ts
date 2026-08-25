"use server";

/**
 * "Avanzar sin señal" (v16): `saveHandover`/`saveReturn` pueden confirmar una
 * entrega/devolución con fotos, firma o documentos todavía sin subir a R2
 * (ver `Inspection.pendingEvidence` en el schema). Esta acción adjunta cada
 * ítem a la inspección ya creada a medida que termina de subir — la llama
 * `EvidenceSync` (`src/components/evidence-sync.tsx`, montado en el layout de
 * toda la app, no solo dentro del wizard) cuando la cola de subida
 * (`src/lib/client/upload-queue.ts`) resuelve un ítem.
 *
 * `pendingEvidence` es un manifiesto ESTÁTICO: nunca se reescribe acá (evita
 * la carrera de dos adjuntos concurrentes pisándose el array). Cada ítem se
 * resuelve con una escritura idempotente propia (upsert por id, o un update
 * puntual), y "¿ya está completo?" se recalcula comparando el manifiesto
 * contra el estado real (signatureUrl/media/damages/documentos) en vez de ir
 * tachando el array.
 */

import { z } from "zod";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { generateAndSendActa } from "@/lib/acta";
import type { PendingEvidenceInput } from "@/lib/inspection-input";

const inputSchema = z.object({
  inspectionId: z.string().min(1),
  localId: z.string().min(1),
  kind: z.enum(["signature", "photo", "video", "damagePhoto", "document"]),
  key: z.string().min(1),
});

export type AttachEvidenceResult =
  | { ok: true; complete: boolean }
  | { ok: false; error: string };

async function isEvidenceComplete(
  inspectionId: string,
  rentalId: string,
  manifest: PendingEvidenceInput[],
): Promise<boolean> {
  if (manifest.length === 0) return true;
  const localIds = manifest.map((e) => e.localId);
  const damageIds = manifest.flatMap((e) => (e.kind === "damagePhoto" ? [e.damageId] : []));

  const [inspection, media, documents, damages] = await Promise.all([
    prisma.inspection.findUnique({ where: { id: inspectionId }, select: { signatureUrl: true } }),
    prisma.inspectionMedia.findMany({ where: { id: { in: localIds } }, select: { id: true } }),
    prisma.rentalDocument.findMany({ where: { id: { in: localIds }, rentalId }, select: { id: true } }),
    damageIds.length
      ? prisma.damage.findMany({ where: { id: { in: damageIds } }, select: { id: true, photoUrl: true } })
      : Promise.resolve([]),
  ]);

  const mediaIds = new Set(media.map((m) => m.id));
  const docIds = new Set(documents.map((d) => d.id));
  const resolvedDamageIds = new Set(damages.filter((d) => d.photoUrl).map((d) => d.id));

  return manifest.every((e) => {
    if (e.kind === "signature") return Boolean(inspection?.signatureUrl);
    if (e.kind === "damagePhoto") return resolvedDamageIds.has(e.damageId);
    return mediaIds.has(e.localId) || docIds.has(e.localId);
  });
}

export async function attachInspectionEvidence(input: unknown): Promise<AttachEvidenceResult> {
  const user = await requireUser();
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };
  const { inspectionId, localId, kind, key } = parsed.data;

  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    select: { id: true, rentalId: true, pendingEvidence: true, evidenceCompletedAt: true },
  });
  if (!inspection) return { ok: false, error: "La inspección no existe." };

  const manifest = (inspection.pendingEvidence as PendingEvidenceInput[] | null) ?? [];
  const expected = manifest.find((e) => e.localId === localId && e.kind === kind);
  if (!expected) {
    // No corresponde a esta inspección, o ya se adjuntó antes (llamado
    // duplicado) — no es un error, es idempotente.
    return { ok: true, complete: inspection.evidenceCompletedAt != null || manifest.length === 0 };
  }

  switch (expected.kind) {
    case "signature":
      await prisma.inspection.update({ where: { id: inspectionId }, data: { signatureUrl: key } });
      break;
    case "photo":
    case "video":
      await prisma.inspectionMedia.upsert({
        where: { id: localId },
        update: {},
        create: { id: localId, inspectionId, type: expected.kind, url: key, capturedAt: new Date() },
      });
      break;
    case "damagePhoto":
      await prisma.damage.update({ where: { id: expected.damageId }, data: { photoUrl: key } });
      break;
    case "document":
      await prisma.rentalDocument.upsert({
        where: { id: localId },
        update: {},
        create: {
          id: localId,
          rentalId: inspection.rentalId,
          kind: expected.docKind,
          url: key,
          holderName: expected.holderName || null,
          uploadedById: user.id,
        },
      });
      break;
  }

  const complete = await isEvidenceComplete(inspectionId, inspection.rentalId, manifest);
  if (complete) {
    // Guard contra dos llamados concurrentes completando al mismo tiempo:
    // solo el que efectivamente pasa `evidenceCompletedAt` de null a la fecha
    // dispara el acta — evita mandar el email dos veces.
    const flip = await prisma.inspection.updateMany({
      where: { id: inspectionId, evidenceCompletedAt: null },
      data: { evidenceCompletedAt: new Date() },
    });
    if (flip.count === 1) {
      after(async () => {
        try {
          await generateAndSendActa(inspectionId);
        } catch (e) {
          console.error("acta generation failed (evidencia demorada)", e);
        }
      });
      revalidatePath(`/rentals/${inspection.rentalId}`);
    }
  }

  return { ok: true, complete };
}
