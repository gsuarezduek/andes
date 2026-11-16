import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Cantidad total de mensajes entrantes de WhatsApp — la pollea el aviso de
 * sonido (`WhatsappSoundNotifier`) cada 10s. Es una ruta y no un Server Action
 * a propósito: el ID de un Server Action cambia en cada deploy, y una pestaña
 * abierta antes del deploy quedaba llamando a un ID inexistente para siempre
 * ("Failed to find Server Action" repetido en el log, y sin sonido). La URL de
 * una ruta no cambia entre builds.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "no autorizado" }, { status: 401 });

  const count = await prisma.whatsAppMessage.count({ where: { direction: "in" } });
  return NextResponse.json({ count });
}
