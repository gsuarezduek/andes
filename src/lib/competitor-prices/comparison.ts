import "server-only";
import type { Currency, CompetitorPriceStatus, SyncResult } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCompetitorPriceSettings } from "./settings";
import { competitorPriceDelta } from "./display";

export type ComparisonCell = {
  price: number | null;
  currency: Currency | null;
  status: CompetitorPriceStatus;
  checkedAt: Date;
  sourceUrl: string | null;
  pickupDate: Date;
  returnDate: Date;
};

export type ComparisonRow = {
  categoryId: string;
  categoryLabel: string;
  ourPrice: number | null;
  cells: Record<string, ComparisonCell>; // por competitorId
  /** % nuestro precio vs. promedio de competencia (solo ARS — nunca se mezclan monedas). */
  deltaPercent: number | null;
};

export type ComparisonData = {
  competitors: { id: string; name: string }[];
  rows: ComparisonRow[];
  offsetDays: number;
  offsetsAvailable: number[];
  lastRun: { finishedAt: Date; result: SyncResult | null } | null;
};

/** Offset válido más cercano al pedido (o el primero disponible si no matchea ninguno). */
export function normalizeOffsetDays(raw: number | undefined, available: number[]): number {
  if (available.length === 0) return 0;
  if (raw != null && available.includes(raw)) return raw;
  return available[0];
}

export async function getComparisonData(offsetDaysRaw?: number): Promise<ComparisonData> {
  const settings = await getCompetitorPriceSettings();
  const offsetDays = normalizeOffsetDays(offsetDaysRaw, settings.offsetsDays);

  const [competitors, categories, currentPrices, ourVehicles, lastRun] = await Promise.all([
    prisma.competitor.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.competitorCategory.findMany({ orderBy: { ordering: "asc" } }),
    prisma.competitorCurrentPrice.findMany({
      where: { pickupOffsetDays: offsetDays },
      include: { priceCheck: true },
    }),
    prisma.vehicle.findMany({
      where: { archivedAt: null, competitorCategoryId: { not: null }, dailyRate: { not: null } },
      select: { competitorCategoryId: true, dailyRate: true },
    }),
    prisma.competitorCheckRun.findFirst({
      where: { finishedAt: { not: null } },
      orderBy: { finishedAt: "desc" },
    }),
  ]);

  // "Nosotros" por categoría: promedio del dailyRate (ya viene de VikRentCar,
  // siempre ARS) de los vehículos propios mapeados a esa categoría.
  const ourByCategory = new Map<string, number[]>();
  for (const v of ourVehicles) {
    if (!v.competitorCategoryId || v.dailyRate == null) continue;
    const list = ourByCategory.get(v.competitorCategoryId) ?? [];
    list.push(Number(v.dailyRate));
    ourByCategory.set(v.competitorCategoryId, list);
  }

  const cellsByCategory = new Map<string, Map<string, ComparisonCell>>();
  for (const cp of currentPrices) {
    const byCompetitor = cellsByCategory.get(cp.categoryId) ?? new Map<string, ComparisonCell>();
    byCompetitor.set(cp.competitorId, {
      price: cp.priceCheck.price != null ? Number(cp.priceCheck.price) : null,
      currency: cp.priceCheck.currency,
      status: cp.priceCheck.status,
      checkedAt: cp.priceCheck.checkedAt,
      sourceUrl: cp.priceCheck.sourceUrl,
      pickupDate: cp.priceCheck.pickupDate,
      returnDate: cp.priceCheck.returnDate,
    });
    cellsByCategory.set(cp.categoryId, byCompetitor);
  }

  const rows: ComparisonRow[] = categories.map((cat) => {
    const ourList = ourByCategory.get(cat.id) ?? [];
    const ourPrice = ourList.length > 0 ? ourList.reduce((a, b) => a + b, 0) / ourList.length : null;
    const cellsMap = cellsByCategory.get(cat.id) ?? new Map<string, ComparisonCell>();
    // Solo ARS para el promedio/delta — nunca se mezclan monedas (mismo
    // criterio que el resto de la app, ver src/lib/currency.ts).
    const competitorArsPrices = [...cellsMap.values()]
      .filter((c) => c.currency === "ars" && c.price != null)
      .map((c) => c.price as number);
    return {
      categoryId: cat.id,
      categoryLabel: cat.label,
      ourPrice,
      cells: Object.fromEntries(cellsMap),
      deltaPercent: competitorPriceDelta(ourPrice, competitorArsPrices),
    };
  });

  return {
    competitors: competitors.map((c) => ({ id: c.id, name: c.name })),
    rows,
    offsetDays,
    offsetsAvailable: settings.offsetsDays,
    lastRun: lastRun ? { finishedAt: lastRun.finishedAt as Date, result: lastRun.result } : null,
  };
}
