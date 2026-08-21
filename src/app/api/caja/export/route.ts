import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth-helpers";
import { getCashPeriodDetail, parseCashPeriod, type CashMovementRow, type CashPeriod } from "@/lib/cash";
import { formatDateTime } from "@/lib/datetime";
import { csvResponse } from "@/lib/csv";

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
    m.paymentMethodName,
    m.recipientPaymentMethodName ?? "",
    m.rentalClientName ?? "",
    m.createdByName,
    formatDateTime(m.createdAt),
  ];
}

/** Exporta los movimientos de Caja del período visible como CSV (admin). ?period=today|week|month|date&from=YYYY-MM-DD&to=YYYY-MM-DD */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const period = parseCashPeriod(
    req.nextUrl.searchParams.get("period") ?? undefined,
    req.nextUrl.searchParams.get("from") ?? undefined,
    req.nextUrl.searchParams.get("to") ?? undefined,
  );
  const detail = await getCashPeriodDetail(period);

  const rows: (string | number)[][] = [
    ["Tipo", "Detalle", "Monto", "Moneda", "Medio de pago", "Destino (egreso)", "Reserva", "Cargado por", "Fecha"],
  ];
  for (const m of detail.incomes) rows.push(toRow(m));
  for (const m of detail.expenses) rows.push(toRow(m));

  return csvResponse(rows, `caja-${periodFileSuffix(period)}`);
}
