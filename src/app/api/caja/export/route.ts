import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth-helpers";
import { hasAdminAccess, hasFinanceAccess } from "@/lib/user-permissions";
import { getCashPeriodDetail, parseCashPeriod, type CashMovementRow, type CashPeriod } from "@/lib/cash";
import { formatDateTime } from "@/lib/datetime";
import { csvResponse } from "@/lib/csv";
import { prisma } from "@/lib/prisma";
import { expandAccountIds, filterCashMovements, parseCashExportFilter } from "@/lib/cash-movement-filter";

export const runtime = "nodejs";

// Nombre de archivo seguro para el header Content-Disposition (ByteString:
// sólo Latin-1). El label legible (`detail.periodLabel`, ej. "Esta semana
// (10/08/2026 – 16/08/2026)") tiene guión largo y paréntesis — rompe el
// header. Se arma en cambio a partir del período crudo, siempre ASCII.
function periodFileSuffix(period: CashPeriod): string {
  if (period.kind !== "date") return period.kind;
  return period.from === period.to ? period.from : `${period.from}_${period.to}`;
}

function toRow(m: CashMovementRow): (string | number)[] {
  return [
    m.type === "income" ? "Ingreso" : "Egreso",
    m.description,
    m.amount,
    m.currency.toUpperCase(),
    m.paymentMethodName + (m.paymentMethodNote ? ` (${m.paymentMethodNote})` : ""),
    m.recipientPaymentMethodName
      ? m.recipientPaymentMethodName + (m.recipientPaymentMethodNote ? ` (${m.recipientPaymentMethodNote})` : "")
      : "",
    m.categoryName ?? "",
    m.rentalClientName ?? "",
    m.createdByName,
    formatDateTime(m.createdAt),
  ];
}

/**
 * Exporta los movimientos de Caja del período como CSV (admin).
 * ?period=today|week|month|date&from=YYYY-MM-DD&to=YYYY-MM-DD
 * Filtros opcionales (mismos que la pantalla, ver `cash-movement-filter.ts`):
 * &account=<id> (repetible; una principal suma sus subcuentas),
 * &type=income|expense, &category=<id>|__none__ (solo egresos).
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !hasAdminAccess(user.role)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const period = parseCashPeriod(
    req.nextUrl.searchParams.get("period") ?? undefined,
    req.nextUrl.searchParams.get("from") ?? undefined,
    req.nextUrl.searchParams.get("to") ?? undefined,
  );
  const filter = parseCashExportFilter(req.nextUrl.searchParams);
  const [detail, methods] = await Promise.all([
    getCashPeriodDetail(period, hasFinanceAccess(user.role, user.owner)),
    filter.accountIds.length
      ? prisma.paymentMethod.findMany({ select: { id: true, parentId: true } })
      : Promise.resolve([]),
  ]);
  const { incomes, expenses } = filterCashMovements(detail, {
    accountIds: expandAccountIds(filter.accountIds, methods),
    categoryId: filter.categoryId,
    type: filter.type,
  });

  const rows: (string | number)[][] = [
    [
      "Tipo",
      "Detalle",
      "Monto",
      "Moneda",
      "Medio de pago",
      "Destino (egreso)",
      "Categoría (egreso)",
      "Reserva",
      "Cargado por",
      "Fecha",
    ],
  ];
  for (const m of incomes) rows.push(toRow(m));
  for (const m of expenses) rows.push(toRow(m));

  const filtered = filter.accountIds.length > 0 || filter.categoryId || filter.type !== "all";
  return csvResponse(rows, `caja-${periodFileSuffix(period)}${filtered ? "-filtrado" : ""}`);
}
