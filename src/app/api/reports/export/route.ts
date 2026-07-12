import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth-helpers";
import { getReports } from "@/lib/reports";

export const runtime = "nodejs";

/** Escapa un valor para CSV (comillas dobles, comas, saltos de línea). */
function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

/** Exporta los reportes como CSV (admin). ?type=vehicles|months */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const type = req.nextUrl.searchParams.get("type") ?? "vehicles";
  const reports = await getReports();

  let rows: (string | number)[][];
  let name: string;
  if (type === "months") {
    rows = [["Mes", "Alquileres finalizados", "Km recorridos"]];
    for (const m of reports.byMonth) rows.push([m.month, m.rentals, m.km]);
    name = "reporte-por-mes";
  } else {
    rows = [["Vehículo", "Patente", "Alquileres", "Ingresos", "Costos", "Neto", "Daños activos"]];
    for (const v of reports.vehicles) rows.push([v.label, v.plate, v.rentals, v.income, v.cost, v.net, v.damages]);
    name = "reporte-por-vehiculo";
  }

  // BOM para que Excel abra los acentos correctamente.
  const csv = "﻿" + toCsv(rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}.csv"`,
    },
  });
}
