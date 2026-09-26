/**
 * Reglas puras de la limpieza de archivos de la nube (Configuración → Nube →
 * Limpieza). Sin `server-only` a propósito: las importa también el panel
 * cliente (etiquetas, categorías) y los tests. Lo que toca R2/base vive en
 * `storage-cleanup.ts`.
 */
import { mendozaWallTimeToUtc } from "@/lib/datetime";

export type CleanupAction = "export" | "delete" | "compress";

export type CleanupCategory =
  | "photos"
  | "damage_photos"
  | "videos"
  | "documents"
  | "wa_image"
  | "wa_video"
  | "wa_audio"
  | "wa_document"
  | "signatures"
  | "actas";

export const CATEGORY_LABELS: Record<CleanupCategory, string> = {
  photos: "Fotos de entregas y devoluciones",
  damage_photos: "Fotos de daños (ya reparados)",
  videos: "Videos de entregas y devoluciones",
  documents: "Documentos (licencia, DNI, pasaporte)",
  wa_image: "WhatsApp — fotos y stickers",
  wa_video: "WhatsApp — videos",
  wa_audio: "WhatsApp — audios",
  wa_document: "WhatsApp — documentos y PDFs",
  signatures: "Firmas de clientes",
  actas: "Actas PDF",
};

export const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as CleanupCategory[];

export function isWhatsAppCategory(c: CleanupCategory): boolean {
  return c.startsWith("wa_");
}

/** Firmas y actas son la evidencia firmada: se pueden descargar y comprimir, NUNCA borrar. */
export const EVIDENCE_CATEGORIES: CleanupCategory[] = ["signatures", "actas"];

/** Categorías que admite cada acción. */
export function categoriesFor(action: CleanupAction): CleanupCategory[] {
  if (action === "delete") return ALL_CATEGORIES.filter((c) => !EVIDENCE_CATEGORIES.includes(c));
  if (action === "compress") return ALL_CATEGORIES.filter((c) => c !== "videos" && c !== "wa_video" && c !== "wa_audio" && c !== "wa_document");
  return ALL_CATEGORIES;
}

/** Antigüedad mínima (en días) que debe tener un archivo para entrar a cada acción. */
export const MIN_AGE_DAYS = {
  /** Evidencia de alquileres: no se borra nada con menos de 6 meses. */
  deleteEvidence: 180,
  /** Comprimir evidencia: no se toca nada con menos de 30 días. */
  compressEvidence: 30,
} as const;

export function minAgeDays(action: CleanupAction, category: CleanupCategory): number {
  if (isWhatsAppCategory(category)) return 0;
  if (action === "delete") return MIN_AGE_DAYS.deleteEvidence;
  if (action === "compress") return MIN_AGE_DAYS.compressEvidence;
  return 0;
}

export type DateRange = { from: Date; toExclusive: Date };

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" desde/hasta (inclusive, hora Mendoza) → rango `[from, toExclusive)`. */
export function parseDateRange(fromStr: string, toStr: string): DateRange | { error: string } {
  if (!DATE_RE.test(fromStr) || !DATE_RE.test(toStr)) return { error: "Elegí las fechas desde y hasta." };
  const from = mendozaWallTimeToUtc(`${fromStr}T00:00`);
  const toExclusive = new Date(mendozaWallTimeToUtc(`${toStr}T00:00`).getTime() + DAY_MS);
  if (Number.isNaN(from.getTime()) || Number.isNaN(toExclusive.getTime())) return { error: "Fechas inválidas." };
  if (from.getTime() >= toExclusive.getTime()) return { error: "La fecha \"desde\" no puede ser posterior a \"hasta\"." };
  return { from, toExclusive };
}

/**
 * Rango efectivo de una categoría: el pedido, recortado para respetar la
 * antigüedad mínima de la acción. `null` si el recorte lo deja vacío.
 */
export function effectiveRange(
  range: DateRange,
  action: CleanupAction,
  category: CleanupCategory,
  now: Date = new Date(),
): DateRange | null {
  const cutoff = new Date(now.getTime() - minAgeDays(action, category) * DAY_MS);
  const toExclusive = new Date(Math.min(range.toExclusive.getTime(), cutoff.getTime()));
  return range.from.getTime() < toExclusive.getTime() ? { from: range.from, toExclusive } : null;
}

/** Valida y filtra las categorías pedidas para la acción. */
export function parseCategories(raw: string[], action: CleanupAction): CleanupCategory[] {
  const allowed = new Set(categoriesFor(action));
  return [...new Set(raw)].filter((c): c is CleanupCategory => allowed.has(c as CleanupCategory));
}

// --- Rutas dentro del ZIP -----------------------------------------------------

/** Deja un texto apto para un nombre de carpeta/archivo dentro del ZIP. */
export function safeSegment(text: string, fallback = "sin-nombre"): string {
  const cleaned = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._ -]+/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+/, "") // nunca un segmento que arranque con "." (".", "..", ocultos)
    .trim()
    .slice(0, 60);
  return cleaned || fallback;
}

export function extOf(key: string, fallback = "bin"): string {
  const m = /\.([a-zA-Z0-9]{1,5})$/.exec(key);
  return m ? m[1]!.toLowerCase() : fallback;
}

// --- Partes del ZIP -------------------------------------------------------------

export const MAX_ZIP_PART_BYTES = 250 * 1024 * 1024;

/**
 * Reparte los ítems en partes de hasta `maxBytes` (un ítem más grande que el
 * tope va solo en su parte). Determinístico: ordena por ruta, así la parte N
 * es la misma cada vez que se pide con el mismo conjunto de archivos.
 */
export function splitIntoParts<T extends { zipPath: string; size: number }>(
  items: T[],
  maxBytes: number = MAX_ZIP_PART_BYTES,
): T[][] {
  const sorted = [...items].sort((a, b) => a.zipPath.localeCompare(b.zipPath));
  const parts: T[][] = [];
  let current: T[] = [];
  let bytes = 0;
  for (const item of sorted) {
    if (current.length > 0 && bytes + item.size > maxBytes) {
      parts.push(current);
      current = [];
      bytes = 0;
    }
    current.push(item);
    bytes += item.size;
  }
  if (current.length > 0) parts.push(current);
  return parts;
}

// --- Compresión ---------------------------------------------------------------------

/** Solo se reemplaza un archivo si la versión comprimida es al menos un 15% más chica. */
export const MIN_SAVING_RATIO = 0.85;

export function worthReplacing(before: number, after: number): boolean {
  return before > 0 && after > 0 && after <= before * MIN_SAVING_RATIO;
}
