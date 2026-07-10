import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth-helpers";
import { storage, actaKey } from "@/lib/storage";
import { renderActaBuffer } from "@/lib/acta";

export const runtime = "nodejs";

/** Descarga del acta PDF. Si no está guardada, la regenera al vuelo. */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "no autorizado" }, { status: 401 });

  const inspectionId = req.nextUrl.searchParams.get("inspectionId") ?? "";
  if (!/^[a-zA-Z0-9_-]+$/.test(inspectionId)) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }

  let pdf: Buffer;
  try {
    pdf = (await storage().get(actaKey(inspectionId))).body;
  } catch {
    try {
      pdf = await renderActaBuffer(inspectionId);
      await storage().put(actaKey(inspectionId), pdf, "application/pdf");
    } catch {
      return NextResponse.json({ error: "no encontrado" }, { status: 404 });
    }
  }

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="acta-${inspectionId}.pdf"`,
    },
  });
}
