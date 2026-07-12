import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth-helpers";
import { storage, uploadKey, type UploadKind } from "@/lib/storage";

export const runtime = "nodejs";

const KINDS: UploadKind[] = ["photo", "video", "signature", "damage", "document"];
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB (defensivo; las fotos van comprimidas)
const idRe = /^[a-zA-Z0-9_-]+$/;

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

  const ext = kind === "video" ? "webm" : "jpg";
  const key = uploadKey(draftId, kind, id, ext);
  const contentType =
    kind === "signature" ? "image/png" : file.type || "application/octet-stream";

  await storage().put(key, buffer, contentType);
  return NextResponse.json({ key });
}
