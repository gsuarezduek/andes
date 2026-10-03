import "server-only";
import { prisma } from "@/lib/prisma";
import type { AccessCredentialField, UserRole } from "@prisma/client";

export type AccessCredentialRevealRow = {
  field: AccessCredentialField;
  userName: string;
  createdAt: Date;
};

export type AccessCredentialRow = {
  id: string;
  service: string;
  username: string | null;
  adminOnly: boolean;
  hasPassword: boolean;
  hasExtra: boolean;
  createdByName: string;
  createdAt: Date;
  updatedByName: string | null;
  updatedAt: Date;
  recentReveals: AccessCredentialRevealRow[];
};

/**
 * Listado para /access. Nunca selecciona `passwordEnc`/`extraEnc` en una
 * query que termine pasándose a un componente cliente — el valor cifrado no
 * tiene por qué viajar al navegador, solo si el campo existe o no (ver
 * `revealAccessCredentialField` en actions.ts para el valor real, bajo pedido).
 */
export async function listAccessCredentials(): Promise<AccessCredentialRow[]> {
  const rows = await prisma.accessCredential.findMany({
    orderBy: { service: "asc" },
    select: {
      id: true,
      service: true,
      username: true,
      adminOnly: true,
      createdByName: true,
      createdAt: true,
      updatedByName: true,
      updatedAt: true,
      passwordEnc: true,
      extraEnc: true,
      reveals: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { field: true, userName: true, createdAt: true },
      },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    service: r.service,
    username: r.username,
    adminOnly: r.adminOnly,
    hasPassword: r.passwordEnc != null,
    hasExtra: r.extraEnc != null,
    createdByName: r.createdByName,
    createdAt: r.createdAt,
    updatedByName: r.updatedByName,
    updatedAt: r.updatedAt,
    recentReveals: r.reveals,
  }));
}

/**
 * Puede revelar password/extra de un acceso: cualquiera si no es `adminOnly`,
 * solo admin si lo es. Pura — la validación real (server-side, nunca
 * confiando en el cliente) vive en `revealAccessCredentialField`.
 */
export function canRevealAccessCredential(adminOnly: boolean, role: UserRole | string): boolean {
  return !adminOnly || role === "admin";
}
