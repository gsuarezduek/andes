import "server-only";
import { prisma } from "@/lib/prisma";
import { OPERATOR_FILTER } from "@/lib/users";

/**
 * Ventana de "conectado": visto en los últimos N minutos. Con el heartbeat de
 * `ConnectedUsers` cada 2 minutos (`POLL_MS`), un usuario activo nunca tiene
 * más de ~2 minutos de antigüedad en `lastSeenAt` — el margen extra hasta acá
 * (15) es para tolerar pings salteados por señal mala/laptop en suspensión
 * sin que la persona parpadee como desconectada.
 */
const ONLINE_WINDOW_MINUTES = 15;

/**
 * Cada cuántos minutos se re-escribe `lastSeenAt` como mínimo. Dos llamadores:
 * el render de `(app)/layout.tsx` (cubre login/F5) y el poll de `GET
 * /api/presence` cada 2 minutos del widget `ConnectedUsers` (cubre el uso
 * normal — por Partial Rendering, el layout no se re-ejecuta al navegar entre
 * rutas que lo comparten, así que sin este segundo llamador alguien activo
 * hace rato en la app dejaba de figurar como conectado). Coincide a propósito
 * con el intervalo del heartbeat: no ahorra escrituras entre sí mismo, pero
 * sigue protegiendo contra un futuro tercer llamador más frecuente.
 */
const TOUCH_THROTTLE_MINUTES = 2;

/** Marca al usuario como visto ahora. Best-effort: nunca debe romper el render del layout. */
export async function touchPresence(userId: string) {
  try {
    const staleBefore = new Date(Date.now() - TOUCH_THROTTLE_MINUTES * 60_000);
    await prisma.user.updateMany({
      where: { id: userId, OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: staleBefore } }] },
      data: { lastSeenAt: new Date() },
    });
  } catch (err) {
    console.error("touchPresence failed", err);
  }
}

export type OnlineUser = { id: string; name: string };

/** Usuarios activos (incluido quien pregunta) vistos en los últimos `ONLINE_WINDOW_MINUTES` minutos. */
export async function getOnlineUsers(): Promise<OnlineUser[]> {
  const since = new Date(Date.now() - ONLINE_WINDOW_MINUTES * 60_000);
  const users = await prisma.user.findMany({
    where: { ...OPERATOR_FILTER, lastSeenAt: { gte: since } },
    select: { id: true, name: true },
    orderBy: { lastSeenAt: "desc" },
  });
  return users;
}
