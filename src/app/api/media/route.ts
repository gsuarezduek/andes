import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

/** Sirve un archivo almacenado (foto/firma/acta) a usuarios autenticados. */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "no autorizado" }, { status: 401 });

  const key = req.nextUrl.searchParams.get("key") ?? "";
  // Solo prefijos conocidos, sin traversal.
  if (!/^(uploads|actas)\/[a-zA-Z0-9_/.-]+$/.test(key) || key.includes("..")) {
    return NextResponse.json({ error: "clave inválida" }, { status: 400 });
  }

  try {
    const { body, contentType } = await storage().get(key);
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "no encontrado" }, { status: 404 });
  }
}
