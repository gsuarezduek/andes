import "server-only";
import { prisma } from "@/lib/prisma";
import type { UserPerm } from "@/lib/user-permissions";

/** Rol y flag de propietario reales (desde la base, no de la sesión). */
export async function getUserPerm(id: string): Promise<UserPerm | null> {
  return prisma.user.findUnique({ where: { id }, select: { id: true, role: true, owner: true } });
}
