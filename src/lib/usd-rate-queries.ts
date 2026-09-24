import "server-only";
import { prisma } from "@/lib/prisma";
import type { UsdRatePoint } from "@/lib/usd-rate";

/** Historial completo del valor de referencia, del más viejo al más nuevo. */
export async function getUsdRateHistory(): Promise<UsdRatePoint[]> {
  const rows = await prisma.usdRate.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map((r) => ({ rate: Number(r.rate), createdAt: r.createdAt }));
}

export type CurrentUsdRate = { rate: number; createdAt: Date; createdByName: string };

/** Último valor de referencia cargado, o `null` si todavía no hay ninguno. */
export async function getCurrentUsdRate(): Promise<CurrentUsdRate | null> {
  const row = await prisma.usdRate.findFirst({ orderBy: { createdAt: "desc" } });
  return row ? { rate: Number(row.rate), createdAt: row.createdAt, createdByName: row.createdByName } : null;
}
