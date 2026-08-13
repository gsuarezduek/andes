import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth-helpers";
import {
  getReports,
  sortVehicleReports,
  parseReportPeriod,
  DEFAULT_VEHICLE_SORT,
  type VehicleSortKey,
} from "@/lib/reports";
import { csvResponse } from "@/lib/csv";

const VEHICLE_SORT_KEYS: VehicleSortKey[] = ["rentals", "days", "income", "cost", "net", "damages"];

export const runtime = "nodejs";

/** Exporta los reportes como CSV (admin). ?type=vehicles|months */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const type = req.nextUrl.searchParams.get("type") ?? "vehicles";
  const period = parseReportPeriod(req.nextUrl.searchParams.get("period") ?? undefined);
  const rawSort = req.nextUrl.searchParams.get("sort");
  const sort = VEHICLE_SORT_KEYS.includes(rawSort as VehicleSortKey)
    ? (rawSort as VehicleSortKey)
    : DEFAULT_VEHICLE_SORT;
  const dir = req.nextUrl.searchParams.get("dir") === "asc" ? "asc" : "desc";

  const reports = await getReports(period);

  let rows: (string | number)[][];
  let name: string;
  if (type === "months") {
    rows = [["Mes", "Alquileres finalizados", "Km recorridos"]];
    for (const m of reports.byMonth) rows.push([m.month, m.rentals, m.km]);
    name = "reporte-por-mes";
  } else {
    rows = [
      ["Vehículo", "Patente", "Alquileres", "Días alquilado", "Ingresos", "Costos", "Neto", "Daños activos", "Archivado"],
    ];
    for (const v of sortVehicleReports(reports.vehicles, sort, dir)) {
      rows.push([
        v.label,
        v.plate,
        v.rentals,
        Number(v.days.toFixed(1)),
        v.income,
        v.cost,
        v.net,
        v.damages,
        v.archived ? "Sí" : "No",
      ]);
    }
    name = "reporte-por-vehiculo";
  }

  return csvResponse(rows, name);
}
