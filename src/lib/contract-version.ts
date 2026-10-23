import "server-only";
import { prisma } from "@/lib/prisma";
import {
  contractTextsFromVersion,
  defaultContractTexts,
  type ResolvedContract,
} from "@/lib/contract-text";

const VERSION_SELECT = { id: true, esTitle: true, esBody: true, enTitle: true, enBody: true } as const;

/** Contrato vigente: la versión más nueva de Configuración → Contrato, o el original. */
export async function getCurrentContract(): Promise<ResolvedContract> {
  const v = await prisma.contractVersion.findFirst({
    orderBy: { createdAt: "desc" },
    select: VERSION_SELECT,
  });
  return v ? { versionId: v.id, texts: contractTextsFromVersion(v) } : { versionId: null, texts: defaultContractTexts() };
}

/**
 * Contrato de una versión puntual (la que firmó una inspección o la que se le
 * mostró al cliente en un pedido de firma remota). Null/desconocida → texto
 * original del sistema: es lo que rige para todo lo anterior a poder editarlo.
 */
export async function getContractByVersion(versionId: string | null | undefined): Promise<ResolvedContract> {
  if (!versionId) return { versionId: null, texts: defaultContractTexts() };
  const v = await prisma.contractVersion.findUnique({ where: { id: versionId }, select: VERSION_SELECT });
  return v ? { versionId: v.id, texts: contractTextsFromVersion(v) } : { versionId: null, texts: defaultContractTexts() };
}

/**
 * Versión a guardar en una inspección: la que el wizard le mostró al cliente
 * si existe; si no vino (bundle viejo) o no existe, la vigente al guardar.
 */
export async function resolveSignedContractVersionId(requested: string | null | undefined): Promise<string | null> {
  if (requested === null) return null;
  if (requested) {
    const exists = await prisma.contractVersion.findUnique({ where: { id: requested }, select: { id: true } });
    if (exists) return exists.id;
  }
  return (await getCurrentContract()).versionId;
}
