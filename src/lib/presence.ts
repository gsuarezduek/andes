import "server-only";
import { prisma } from "@/lib/prisma";

/** Ventana de "conectado": visto en los últimos N minutos. */
const ONLINE_WINDOW_MINUTES = 5;

/**
 * Cada cuántos minutos se re-escribe `lastSeenAt` como mínimo. No es un
 * heartbeat dedicado — se llama en cada render del layout autenticado
 * (`(app)/layout.tsx`), así que este umbral solo evita pisar la columna en
 * cada navegación; mientras el usuario navega la app, se mantiene "fresco"
 * solo, sin ningún timer de cliente pegándole al servidor.
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

export type OnlineUser = { id: string; name: string; role: string };

/** Otros usuarios activos vistos en los últimos `ONLINE_WINDOW_MINUTES` minutos. */
export async function getOnlineUsers(excludeUserId: string): Promise<OnlineUser[]> {
  const since = new Date(Date.now() - ONLINE_WINDOW_MINUTES * 60_000);
  const users = await prisma.user.findMany({
    where: { id: { not: excludeUserId }, active: true, lastSeenAt: { gte: since } },
    select: { id: true, name: true, role: true },
    orderBy: { lastSeenAt: "desc" },
  });
  return users;
}
