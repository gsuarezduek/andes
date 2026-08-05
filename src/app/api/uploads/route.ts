import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth-helpers";
import { storage, uploadKey, type UploadKind } from "@/lib/storage";

export const runtime = "nodejs";

const KINDS: UploadKind[] = ["photo", "video", "signature", "damage", "document"];
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB (defensivo; las fotos van comprimidas)
const idRe = /^[a-zA-Z0-9_-]+$/;

/**
 * Content-Type real por los primeros bytes del archivo — nunca el que manda
 * el cliente (`file.type`), que cualquiera puede falsificar. Si no matchea
 * ningún formato binario conocido, se sirve como descarga genérica en vez de
 * confiar en un string arbitrario: evita que un archivo subido con
 * Content-Type falso (ej. `text/html` con un `<script>` adentro) se renderice
 * como HTML cuando un admin lo abre desde /api/media.
 */
function sniffContentType(buffer: Buffer): string {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  // Contenedor Matroska/WebM (MediaRecorder del navegador).
  if (buffer.length >= 4 && buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return "video/webm";
  }
  return "application/octet-stream";
}

/** Subida en segundo plano de una foto/firma/daño de un borrador de inspección. */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "no autorizado" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const draftId = String(form.get("draftId") ?? "");
  const kind = String(form.get("kind") ?? "") as UploadKind;
  const id = String(form.get("id") ?? crypto.randomUUID());

  if (!(file instanceof File) || !KINDS.includes(kind)) {
    return NextResponse.json({ error: "petición inválida" }, { status: 400 });
  }
  if (!idRe.test(draftId) || !idRe.test(id)) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0 || buffer.length > MAX_BYTES) {
    return NextResponse.json({ error: "tamaño inválido" }, { status: 413 });
  }

  const ext = kind === "video" ? "webm" : kind === "signature" ? "png" : "jpg";
  const key = uploadKey(draftId, kind, id, ext);
  // La firma la genera el propio canvas (siempre PNG, sin archivo de por
  // medio); el resto son archivos que el cliente eligió — nunca se confía en
  // su Content-Type declarado, se detecta por los bytes reales.
  const contentType = kind === "signature" ? "image/png" : sniffContentType(buffer);

  await storage().put(key, buffer, contentType);
  return NextResponse.json({ key });
}
