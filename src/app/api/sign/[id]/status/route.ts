import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Estado del pedido de firma remota. Lo poolea el wizard del empleado para
 * detectar cuándo el cliente firmó y tomar la firma. Público (id no adivinable);
 * sólo revela el estado y la clave de la firma (que a su vez sólo se sirve por
 * /api/media con sesión).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const request = await prisma.signatureRequest.findUnique({
    where: { id },
    select: { status: true, signatureKey: true, signerName: true, expiresAt: true },
  });
  if (!request) return NextResponse.json({ error: "no encontrado" }, { status: 404 });

  const status =
    request.status === "pending" && request.expiresAt.getTime() <= Date.now()
      ? "expired"
      : request.status;

  return NextResponse.json({
    status,
    signatureKey: request.signatureKey,
    signerName: request.signerName,
  });
}
