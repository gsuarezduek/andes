/**
 * Abstracción de almacenamiento de archivos (fotos, videos, firmas, PDFs).
 *
 * En producción usa Cloudflare R2 (S3-compatible). En desarrollo, si no hay
 * credenciales R2, cae a un almacenamiento en el filesystem local (`.storage/`,
 * gitignored) para poder probar el flujo completo sin R2.
 *
 * El bucket es privado: nada se sirve por URL pública. La app entrega los
 * archivos a través de rutas autenticadas, y el PDF/email leen los bytes
 * directamente desde acá en el servidor.
 */

import "server-only";

export type StoredObject = { key: string; size: number; lastModified: Date };

export interface Storage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<{ body: Buffer; contentType: string }>;
  /** Borra un objeto. No falla si ya no existe. Solo lo usa la limpieza de Configuración → Nube. */
  delete(key: string): Promise<void>;
  /** Lista TODOS los objetos (clave, tamaño, fecha) — para el inventario de la limpieza. */
  list(): Promise<StoredObject[]>;
}

function hasR2(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY,
  );
}

// --- R2 (S3-compatible) ----------------------------------------------------

class R2Storage implements Storage {
  private bucket = process.env.R2_BUCKET || "andes-media";
  private clientPromise = this.makeClient();

  private async makeClient() {
    const { S3Client } = await import("@aws-sdk/client-s3");
    return new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }

  async put(key: string, body: Buffer, contentType: string) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.clientPromise;
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async get(key: string) {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.clientPromise;
    const res = await client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const bytes = await res.Body!.transformToByteArray();
    return {
      body: Buffer.from(bytes),
      contentType: res.ContentType || "application/octet-stream",
    };
  }

  async delete(key: string) {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.clientPromise;
    await client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async list() {
    const { ListObjectsV2Command } = await import("@aws-sdk/client-s3");
    const client = await this.clientPromise;
    const out: StoredObject[] = [];
    let token: string | undefined;
    // 1 llamada cada 1000 objetos.
    do {
      const res = await client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, ContinuationToken: token }),
      );
      for (const obj of res.Contents ?? []) {
        if (!obj.Key) continue;
        out.push({ key: obj.Key, size: obj.Size ?? 0, lastModified: obj.LastModified ?? new Date(0) });
      }
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);
    return out;
  }
}

// --- Local filesystem (solo dev) ------------------------------------------

class LocalStorage implements Storage {
  private async baseDir() {
    const path = await import("node:path");
    return path.join(process.cwd(), ".storage");
  }

  private async pathFor(key: string) {
    const path = await import("node:path");
    return path.join(await this.baseDir(), key);
  }

  async put(key: string, body: Buffer, contentType: string) {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const file = await this.pathFor(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, body);
    await fs.writeFile(`${file}.meta`, contentType, "utf8");
  }

  async get(key: string) {
    const fs = await import("node:fs/promises");
    const file = await this.pathFor(key);
    const body = await fs.readFile(file);
    let contentType = "application/octet-stream";
    try {
      contentType = await fs.readFile(`${file}.meta`, "utf8");
    } catch {
      // sin meta: default
    }
    return { body, contentType };
  }

  async delete(key: string) {
    const fs = await import("node:fs/promises");
    const file = await this.pathFor(key);
    await fs.rm(file, { force: true });
    await fs.rm(`${file}.meta`, { force: true });
  }

  async list() {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const base = await this.baseDir();
    const out: StoredObject[] = [];
    async function walk(dir: string): Promise<void> {
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) await walk(full);
        else if (!e.name.endsWith(".meta")) {
          const st = await fs.stat(full);
          out.push({
            key: path.relative(base, full).split(path.sep).join("/"),
            size: st.size,
            lastModified: st.mtime,
          });
        }
      }
    }
    await walk(base);
    return out;
  }
}

let instance: Storage | null = null;

/** Devuelve el backend de almacenamiento activo (R2 o local). */
export function storage(): Storage {
  if (!instance) {
    instance = hasR2() ? new R2Storage() : new LocalStorage();
  }
  return instance;
}

/** True si hay R2 configurado (para avisos en la UI durante el desarrollo). */
export const usingR2 = hasR2;

// --- Helpers de claves -----------------------------------------------------
//
// Las fotos/firma se suben en segundo plano DURANTE el flujo, antes de que la
// inspección exista en la base. Por eso se agrupan bajo un `draftId` del
// borrador; al guardar, la inspección referencia esas claves tal cual (no hay
// que mover nada). El acta sí se guarda bajo el id de la inspección ya creada.

export type UploadKind = "photo" | "video" | "signature" | "damage" | "document";

export function uploadKey(
  draftId: string,
  kind: UploadKind,
  id: string,
  ext: string,
): string {
  const folder =
    kind === "photo"
      ? "photos"
      : kind === "video"
        ? "videos"
        : kind === "damage"
          ? "damages"
          : kind === "document"
            ? "documents"
            : "signature";
  if (kind === "signature") return `uploads/${draftId}/signature.png`;
  return `uploads/${draftId}/${folder}/${id}.${ext}`;
}

export const actaKey = (inspectionId: string) => `actas/${inspectionId}.pdf`;
