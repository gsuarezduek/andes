import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-helpers";
import { getOnlineUsers, touchPresence } from "@/lib/presence";

export const runtime = "nodejs";

/**
 * Otros usuarios conectados ahora — pollea el widget del header (`ConnectedUsers`,
 * cada 2 minutos mientras la pestaña está visible). También es el heartbeat real de
 * presencia: por Partial Rendering, `(app)/layout.tsx` (donde vive el otro
 * `touchPresence`) no se re-ejecuta al navegar entre rutas que comparten ese
 * layout — es decir, casi nunca durante el uso normal — así que sin este golpe
 * periódico alguien activo hace rato en la app deja de figurar como conectado.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "no autorizado" }, { status: 401 });

  const [users] = await Promise.all([getOnlineUsers(user.id), touchPresence(user.id)]);
  return NextResponse.json(users);
}
