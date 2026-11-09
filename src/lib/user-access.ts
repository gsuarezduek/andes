import "server-only";
import { prisma } from "@/lib/prisma";
import type { Role, UserPerm } from "@/lib/user-permissions";

/** Rol y flag de propietario reales (desde la base, no de la sesión). */
export async function getUserPerm(id: string): Promise<UserPerm | null> {
  return prisma.user.findUnique({ where: { id }, select: { id: true, role: true, owner: true } });
}

/**
 * Permisos con los que actúa quien está logueado en la gestión de usuarios:
 * los reales de la base, salvo que esté en "Ver como…" — ahí actúa con el rol
 * simulado y sin los poderes de propietario, igual que el resto de la app.
 */
export async function getActorPerm(user: { id: string; viewAs: Role | null }): Promise<UserPerm | null> {
  const perm = await getUserPerm(user.id);
  if (!perm || !user.viewAs) return perm;
  return { ...perm, role: user.viewAs, owner: false };
}
