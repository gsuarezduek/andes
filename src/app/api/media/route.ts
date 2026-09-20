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
  if (!/^(uploads|actas|whatsapp)\/[a-zA-Z0-9_/.-]+$/.test(key) || key.includes("..")) {
    return NextResponse.json({ error: "clave inválida" }, { status: 400 });
  }

  try {
    const { body, contentType } = await storage().get(key);
    const baseHeaders = {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
      // Defensa en profundidad: aunque el Content-Type ya se calcula
      // server-side (nunca del cliente), esto evita que el navegador
      // "adivine" un tipo distinto a partir del contenido.
      "X-Content-Type-Options": "nosniff",
      "Accept-Ranges": "bytes",
    };

    // `<audio>`/`<video>` (adjuntos de WhatsApp) necesitan poder pedir bytes
    // parciales: Safari en particular puede no reproducir nada si el server
    // no responde a un Range — sin esto, escuchar un audio desde el celular
    // podía quedar roto silenciosamente en iOS aunque funcionara en Chrome.
    // Alcanza con partir el buffer ya leído (los archivos son cortos: notas
    // de voz/videos de WhatsApp), sin necesidad de un range fetch real
    // contra R2.
    const range = req.headers.get("range");
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (match) {
        const total = body.length;
        const start = match[1] ? parseInt(match[1], 10) : 0;
        const end = match[2] ? Math.min(parseInt(match[2], 10), total - 1) : total - 1;
        if (start <= end && start < total) {
          const chunk = body.subarray(start, end + 1);
          return new NextResponse(new Uint8Array(chunk), {
            status: 206,
            headers: {
              ...baseHeaders,
              "Content-Range": `bytes ${start}-${end}/${total}`,
              "Content-Length": String(chunk.length),
            },
          });
        }
      }
    }

    return new NextResponse(new Uint8Array(body), { headers: baseHeaders });
  } catch {
    return NextResponse.json({ error: "no encontrado" }, { status: 404 });
  }
}
