import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth-helpers";
import { renderOwnerContractBuffer } from "@/lib/owner-contract-server";

export const runtime = "nodejs";

/** PDF del contrato de cesión. Se arma a demanda: todo lo firmado queda guardado en la fila. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "no autorizado" }, { status: 401 });

  const { id } = await params;
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }

  let pdf: Buffer;
  try {
    pdf = await renderOwnerContractBuffer(id);
  } catch (e) {
    console.error(`[owner-contract] no se pudo generar el PDF del contrato ${id}`, e);
    return NextResponse.json({ error: "no encontrado" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="contrato-cesion-${id}.pdf"`,
    },
  });
}
