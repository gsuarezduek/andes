/**
 * Arma el "plan" de la limpieza de archivos: qué objetos de R2 entran para una
 * acción (descargar / eliminar / comprimir), un rango de fechas y unas
 * categorías. Parte SIEMPRE del inventario de la base (fotos, daños,
 * documentos, adjuntos de WhatsApp) cruzado con el listado real del bucket
 * (tamaños); nunca borra "por prefijo".
 *
 * Reglas de seguridad de `delete` (evidencia de alquileres):
 *  - solo alquileres FINALIZADOS, con la inspección completa (evidencia ya
 *    adjuntada) y el acta PDF guardada en el bucket;
 *  - solo archivos con más de 6 meses (`MIN_AGE_DAYS.deleteEvidence`);
 *  - fotos de daños: solo si el daño ya se reparó (uno activo sigue mostrándose);
 *  - firmas y actas nunca (ni siquiera son categorías de `delete`).
 */
import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { storage, actaKey, type StoredObject } from "@/lib/storage";
import {
  CATEGORY_LABELS,
  effectiveRange,
  extOf,
  safeSegment,
  minAgeDays,
  type CleanupAction,
  type CleanupCategory,
  type DateRange,
} from "@/lib/storage-cleanup-rules";
import { formatDateInput } from "@/lib/datetime";

export type PlanItem = {
  key: string;
  category: CleanupCategory;
  size: number;
  /** Ruta dentro del ZIP (carpetas por reserva / conversación). */
  zipPath: string;
};

export type CategorySummary = { category: CleanupCategory; label: string; count: number; bytes: number };

export type CleanupPlan = {
  action: CleanupAction;
  items: PlanItem[];
  totalBytes: number;
  byCategory: CategorySummary[];
  /** Avisos de recorte por antigüedad mínima, por categoría, para mostrarle al usuario. */
  notes: string[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_LABEL: Record<string, string> = { handover: "entrega", return_: "devolucion" };

type RentalLite = { clientName: string; wpBookingId: number | null; startAt: Date; id: string };

function rentalFolder(r: RentalLite): string {
  const ref = r.wpBookingId != null ? `reserva ${r.wpBookingId}` : `reserva ${r.id.slice(-6)}`;
  return `${safeSegment(r.clientName, "cliente")} - ${ref} - ${formatDateInput(r.startAt)}`;
}

/** Huella del conjunto de archivos: es lo que ata una descarga completa a una eliminación. */
export function planHash(items: Pick<PlanItem, "key" | "category">[]): string {
  const h = createHash("sha256");
  for (const line of items.map((i) => `${i.category}:${i.key}`).sort()) h.update(line + "\n");
  return h.digest("hex");
}

export async function buildCleanupPlan(input: {
  action: CleanupAction;
  categories: CleanupCategory[];
  range: DateRange;
  now?: Date;
}): Promise<CleanupPlan> {
  const { action, categories, range } = input;
  const now = input.now ?? new Date();

  const listed: StoredObject[] = await storage().list();
  const objects = new Map(listed.map((o) => [o.key, o]));

  const items: PlanItem[] = [];
  const seen = new Set<string>();
  const notes: string[] = [];

  const push = (key: string | null | undefined, category: CleanupCategory, zipPath: string) => {
    if (!key || seen.has(key)) return;
    const obj = objects.get(key);
    if (!obj) return; // ya no está en el bucket (o nunca se subió)
    seen.add(key);
    items.push({ key, category, size: obj.size, zipPath });
  };

  for (const category of categories) {
    const eff = effectiveRange(range, action, category, now);
    const floor = minAgeDays(action, category);
    if (eff == null) {
      notes.push(`${CATEGORY_LABELS[category]}: nada para ${action === "delete" ? "eliminar" : "comprimir"} en ese rango (solo se toca lo que tiene más de ${floor} días).`);
      continue;
    }
    if (floor > 0 && eff.toExclusive.getTime() < range.toExclusive.getTime()) {
      notes.push(
        `${CATEGORY_LABELS[category]}: por seguridad solo se incluye lo anterior al ${formatDateInput(new Date(eff.toExclusive.getTime() - DAY_MS))} (mínimo ${floor} días de antigüedad).`,
      );
    }
    const between = { gte: eff.from, lt: eff.toExclusive };
    const deleting = action === "delete";

    switch (category) {
      case "photos":
      case "videos": {
        const rows = await prisma.inspectionMedia.findMany({
          where: {
            type: category === "photos" ? "photo" : "video",
            inspection: {
              createdAt: between,
              ...(deleting ? { evidenceCompletedAt: { not: null }, rental: { status: "finished" } } : {}),
            },
          },
          select: {
            id: true,
            url: true,
            inspection: {
              select: {
                id: true,
                type: true,
                rental: { select: { id: true, clientName: true, wpBookingId: true, startAt: true } },
              },
            },
          },
        });
        for (const r of rows) {
          if (deleting && !objects.has(actaKey(r.inspection.id))) continue; // sin acta guardada, no se toca
          const folder = category === "photos" ? "fotos" : "videos";
          push(
            r.url,
            category,
            `${rentalFolder(r.inspection.rental)}/${DAY_LABEL[r.inspection.type] ?? "inspeccion"}/${folder}/${folder.slice(0, -1)}-${r.id.slice(-6)}.${extOf(r.url, category === "photos" ? "jpg" : "mp4")}`,
          );
        }
        break;
      }

      case "damage_photos": {
        const rows = await prisma.damage.findMany({
          where: {
            photoUrl: { not: null },
            createdAt: between,
            ...(deleting ? { repairedAt: { not: null, lt: new Date(now.getTime() - minAgeDays("delete", category) * DAY_MS) } } : {}),
          },
          select: { id: true, photoUrl: true, vehicle: { select: { plate: true, name: true } } },
        });
        for (const d of rows) {
          push(d.photoUrl, category, `danos/${safeSegment(d.vehicle.name ?? d.vehicle.plate, "auto")}/dano-${d.id.slice(-6)}.${extOf(d.photoUrl ?? "", "jpg")}`);
        }
        break;
      }

      case "documents": {
        const rows = await prisma.rentalDocument.findMany({
          where: { capturedAt: between, ...(deleting ? { rental: { status: "finished" } } : {}) },
          select: {
            id: true,
            url: true,
            kind: true,
            holderName: true,
            rental: { select: { id: true, clientName: true, wpBookingId: true, startAt: true } },
          },
        });
        for (const d of rows) {
          const who = d.holderName ? `-${safeSegment(d.holderName)}` : "";
          push(d.url, category, `${rentalFolder(d.rental)}/documentos/${d.kind}${who}-${d.id.slice(-6)}.${extOf(d.url, "jpg")}`);
        }
        break;
      }

      case "signatures": {
        const rows = await prisma.inspection.findMany({
          where: { createdAt: between, signatureUrl: { not: null } },
          select: {
            id: true,
            type: true,
            signatureUrl: true,
            rental: { select: { id: true, clientName: true, wpBookingId: true, startAt: true } },
          },
        });
        for (const i of rows) {
          push(i.signatureUrl, category, `${rentalFolder(i.rental)}/${DAY_LABEL[i.type] ?? "inspeccion"}/firma.${extOf(i.signatureUrl ?? "", "png")}`);
        }
        break;
      }

      case "actas": {
        const rows = await prisma.inspection.findMany({
          where: { createdAt: between },
          select: {
            id: true,
            type: true,
            rental: { select: { id: true, clientName: true, wpBookingId: true, startAt: true } },
          },
        });
        for (const i of rows) {
          push(actaKey(i.id), category, `${rentalFolder(i.rental)}/acta-${DAY_LABEL[i.type] ?? "inspeccion"}.pdf`);
        }
        break;
      }

      case "wa_image":
      case "wa_video":
      case "wa_audio":
      case "wa_document": {
        const kinds =
          category === "wa_image"
            ? // Los stickers (webp, a veces animados) no se comprimen: solo se descargan o eliminan.
              action === "compress"
              ? (["image"] as const)
              : (["image", "sticker"] as const)
            : category === "wa_video"
              ? (["video"] as const)
              : category === "wa_audio"
                ? (["audio"] as const)
                : (["document"] as const);
        const rows = await prisma.whatsAppMedia.findMany({
          where: { deletedAt: null, kind: { in: [...kinds] }, createdAt: between },
          select: {
            id: true,
            storageKey: true,
            kind: true,
            createdAt: true,
            message: {
              select: { conversation: { select: { phoneE164: true, customer: { select: { name: true } } } } },
            },
          },
        });
        for (const m of rows) {
          const conv = m.message?.conversation;
          const who = safeSegment(conv?.customer?.name ? `${conv.customer.name} ${conv.phoneE164}` : (conv?.phoneE164 ?? "sin-conversacion"), "sin-conversacion");
          push(m.storageKey, category, `whatsapp/${who}/${formatDateInput(m.createdAt)}-${m.kind}-${m.id.slice(-6)}.${extOf(m.storageKey, "bin")}`);
        }
        break;
      }
    }
  }

  // Rutas únicas dentro del ZIP (por si dos archivos caen en el mismo nombre).
  const used = new Map<string, number>();
  for (const it of items) {
    const n = used.get(it.zipPath) ?? 0;
    used.set(it.zipPath, n + 1);
    if (n > 0) it.zipPath = it.zipPath.replace(/(\.[a-zA-Z0-9]+)?$/, `-${n + 1}$1`);
  }

  const byCat = new Map<CleanupCategory, CategorySummary>();
  let totalBytes = 0;
  for (const it of items) {
    const acc = byCat.get(it.category) ?? { category: it.category, label: CATEGORY_LABELS[it.category], count: 0, bytes: 0 };
    acc.count += 1;
    acc.bytes += it.size;
    byCat.set(it.category, acc);
    totalBytes += it.size;
  }

  return { action, items, totalBytes, byCategory: [...byCat.values()], notes };
}
