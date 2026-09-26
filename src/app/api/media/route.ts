import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";
import { prisma } from "@/lib/prisma";

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
    // Borrado a propósito desde Configuración → Nube → Limpiar archivos: en vez
    // de una imagen rota, se muestra un cartel (las <img> de daños y documentos
    // apuntan acá). Un SVG estático dentro de <img> no ejecuta nada.
    const deleted = await prisma.deletedFile
      .findUnique({ where: { storageKey: key }, select: { id: true } })
      .catch(() => null);
    if (deleted) {
      return new NextResponse(DELETED_PLACEHOLDER_SVG, {
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "private, max-age=3600",
          "X-Content-Type-Options": "nosniff",
          "X-Andes-File-Deleted": "1",
        },
      });
    }
    return NextResponse.json({ error: "no encontrado" }, { status: 404 });
  }
}

const DELETED_PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320">
<rect width="480" height="320" fill="#f3f4f6"/>
<text x="240" y="150" text-anchor="middle" font-family="sans-serif" font-size="22" font-weight="600" fill="#4b5563">Archivo eliminado</text>
<text x="240" y="184" text-anchor="middle" font-family="sans-serif" font-size="15" fill="#6b7280">Se borró para liberar espacio</text>
</svg>`;
