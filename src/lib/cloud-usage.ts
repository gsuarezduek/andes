/**
 * Uso de la nube: tamaño de la base de datos (PostgreSQL en Railway) y del
 * almacenamiento de archivos (bucket de Cloudflare R2). Solo lectura; se
 * calcula a demanda al abrir Configuración → Nube.
 */

import "server-only";
import { prisma } from "@/lib/prisma";
import { usingR2 } from "@/lib/storage";

/** Plan gratuito de Cloudflare R2 (por mes): 10 GB de almacenamiento. */
export const R2_FREE_TIER_BYTES = 10 * 1024 ** 3;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[i]}`;
}

// --- Base de datos ----------------------------------------------------------

export type DbUsage = {
  totalBytes: number;
  tables: { name: string; bytes: number; rows: number }[];
};

export async function getDatabaseUsage(): Promise<DbUsage> {
  const [size, tables] = await Promise.all([
    prisma.$queryRaw<{ bytes: bigint }[]>`SELECT pg_database_size(current_database()) AS bytes`,
    prisma.$queryRaw<{ name: string; bytes: bigint; rows: bigint }[]>`
      SELECT c.relname AS name,
             pg_total_relation_size(c.oid) AS bytes,
             c.reltuples::bigint AS rows
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'r' AND n.nspname = 'public'
      ORDER BY pg_total_relation_size(c.oid) DESC
      LIMIT 8`,
  ]);
  return {
    totalBytes: Number(size[0]?.bytes ?? 0),
    tables: tables.map((t) => ({
      name: t.name,
      bytes: Number(t.bytes),
      rows: Math.max(0, Number(t.rows)),
    })),
  };
}

// --- Archivos (R2) ----------------------------------------------------------

export type FileCategory =
  | "Fotos"
  | "Fotos de daños"
  | "Videos"
  | "Firmas"
  | "Documentos (licencia/DNI)"
  | "Actas PDF"
  | "WhatsApp"
  | "Otros";

export function categorizeKey(key: string): FileCategory {
  if (key.startsWith("actas/")) return "Actas PDF";
  if (key.startsWith("whatsapp")) return "WhatsApp";
  if (key.endsWith("/signature.png")) return "Firmas";
  if (key.includes("/photos/")) return "Fotos";
  if (key.includes("/damages/")) return "Fotos de daños";
  if (key.includes("/videos/")) return "Videos";
  if (key.includes("/documents/")) return "Documentos (licencia/DNI)";
  return "Otros";
}

export type FileUsage =
  | { available: false }
  | {
      available: true;
      totalBytes: number;
      totalObjects: number;
      categories: { name: FileCategory; bytes: number; objects: number }[];
    };

export async function getFileUsage(): Promise<FileUsage> {
  if (!usingR2()) return { available: false };

  const { S3Client, ListObjectsV2Command } = await import("@aws-sdk/client-s3");
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  const bucket = process.env.R2_BUCKET || "andes-media";

  const byCategory = new Map<FileCategory, { bytes: number; objects: number }>();
  let totalBytes = 0;
  let totalObjects = 0;
  let token: string | undefined;

  // 1 llamada cada 1000 objetos; a esta escala (miles de fotos) son pocas.
  do {
    const res = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }),
    );
    for (const obj of res.Contents ?? []) {
      const size = obj.Size ?? 0;
      const cat = categorizeKey(obj.Key ?? "");
      const acc = byCategory.get(cat) ?? { bytes: 0, objects: 0 };
      acc.bytes += size;
      acc.objects += 1;
      byCategory.set(cat, acc);
      totalBytes += size;
      totalObjects += 1;
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);

  const categories = [...byCategory.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.bytes - a.bytes);

  return { available: true, totalBytes, totalObjects, categories };
}
