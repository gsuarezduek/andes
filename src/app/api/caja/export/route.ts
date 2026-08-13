import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth-helpers";
import { getCashMonthDetail, currentMonth, type CashMovementRow } from "@/lib/cash";
import { formatDateTime } from "@/lib/datetime";
import { csvResponse } from "@/lib/csv";

export const runtime = "nodejs";

function toRow(m: CashMovementRow): (string | number)[] {
  return [
    m.type === "income" ? "Ingreso" : "Egreso",
    m.description,
    m.amount,
    m.paymentMethodName,
    m.recipientPaymentMethodName ?? "",
    m.rentalClientName ?? "",
    m.createdByName,
    formatDateTime(m.createdAt),
  ];
}

/** Exporta los movimientos de Caja del mes visible como CSV (admin). ?month=YYYY-MM */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const rawMonth = req.nextUrl.searchParams.get("month");
  const month = rawMonth && /^\d{4}-\d{2}$/.test(rawMonth) ? rawMonth : currentMonth();
  const detail = await getCashMonthDetail(month);

  const rows: (string | number)[][] = [
    ["Tipo", "Detalle", "Monto", "Medio de pago", "Destino (egreso)", "Reserva", "Cargado por", "Fecha"],
  ];
  for (const m of detail.incomes) rows.push(toRow(m));
  for (const m of detail.expenses) rows.push(toRow(m));

  return csvResponse(rows, `caja-${month}`);
}
