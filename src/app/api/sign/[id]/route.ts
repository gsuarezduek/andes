import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { storage, uploadKey } from "@/lib/storage";
import { isSignatureRequestUsable } from "@/lib/remote-signature";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB (la firma es un PNG chico)

/**
 * Recibe la firma del cliente (sin sesión). Se valida por el id no adivinable +
 * expiración + un solo uso. La firma se guarda bajo la misma clave que espera
 * el guardado del wizard (uploads/{draftId}/signature.png).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const request = await prisma.signatureRequest.findUnique({ where: { id } });
  if (!request) return NextResponse.json({ error: "no encontrado" }, { status: 404 });

  const now = new Date();
  if (!isSignatureRequestUsable(request, now)) {
    if (request.status === "pending" && request.expiresAt.getTime() <= now.getTime()) {
      await prisma.signatureRequest.update({ where: { id }, data: { status: "expired" } });
    }
    return NextResponse.json({ error: "el pedido no está disponible" }, { status: 409 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const signerName = String(form.get("signerName") ?? "").trim();
  if (!(file instanceof File) || !signerName) {
    return NextResponse.json({ error: "petición inválida" }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0 || buffer.length > MAX_BYTES) {
    return NextResponse.json({ error: "tamaño inválido" }, { status: 413 });
  }

  const key = uploadKey(request.draftId, "signature", "remote", "png");
  await storage().put(key, buffer, "image/png");

  // Un solo uso: sólo pasa a `signed` si seguía `pending` (atómico).
  const res = await prisma.signatureRequest.updateMany({
    where: { id, status: "pending" },
    data: { status: "signed", signatureKey: key, signerName },
  });
  if (res.count === 0) {
    return NextResponse.json({ error: "el pedido no está disponible" }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
