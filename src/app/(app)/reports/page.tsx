import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-helpers";
import {
  getReports,
  sortVehicleReports,
  parseReportPeriod,
  reportPeriodParam,
  reportPeriodLabel,
  REPORT_PERIOD_OPTIONS,
  DEFAULT_VEHICLE_SORT,
  type MonthPoint,
  type VehicleSortKey,
} from "@/lib/reports";
import { formatArs } from "@/lib/contract";

export const metadata: Metadata = { title: "Reportes — Andes" };

const VEHICLE_SORT_KEYS: VehicleSortKey[] = ["rentals", "days", "income", "cost", "net", "damages"];
const VEHICLE_SORT_LABELS: Record<VehicleSortKey, string> = {
  rentals: "Alquileres",
  days: "Días alquilado",
  income: "Ingresos",
  cost: "Costos",
  net: "Neto",
  damages: "Daños activos",
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; sort?: string; dir?: string }>;
}) {
  await requireAdmin();
  const { period: rawPeriod, sort: rawSort, dir: rawDir } = await searchParams;

  const period = parseReportPeriod(rawPeriod);
  const periodParam = reportPeriodParam(period);
  const sort = VEHICLE_SORT_KEYS.includes(rawSort as VehicleSortKey)
    ? (rawSort as VehicleSortKey)
    : DEFAULT_VEHICLE_SORT;
  const dir = rawDir === "asc" ? "asc" : "desc";

  const { kpis, byMonth, highlightMonth, vehicles: unsortedVehicles, cashByOwnership } = await getReports(period);
  const vehicles = sortVehicleReports(unsortedVehicles, sort, dir);

  /** href de un encabezado de columna: si ya se ordena por esa columna, invierte la dirección. */
  function sortHref(key: VehicleSortKey): string {
    const nextDir = sort === key && dir === "desc" ? "asc" : "desc";
    return `/reports?period=${periodParam}&sort=${key}&dir=${nextDir}`;
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reportes</h1>
          <p className="text-sm text-foreground/60">{reportPeriodLabel(period)}</p>
        </div>
        <form className="flex items-center gap-2">
          {sort !== DEFAULT_VEHICLE_SORT && <input type="hidden" name="sort" value={sort} />}
          {dir !== "desc" && <input type="hidden" name="dir" value={dir} />}
          <select
            name="period"
            defaultValue={periodParam}
            className="h-9 rounded-lg border border-foreground/15 bg-transparent px-2 text-sm outline-none focus:border-foreground/40"
          >
            {REPORT_PERIOD_OPTIONS.map((o) => (
              <option key={o.param} value={o.param}>
                {o.label}
              </option>
            ))}
          </select>
          <button className="h-9 rounded-lg border border-foreground/15 px-3 text-sm font-medium">
            Aplicar
          </button>
        </form>
      </div>

      {/* Estado actual de la flota — no depende del período elegido */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-foreground/70">Flota (estado actual)</h2>
        <div className="grid grid-cols-3 gap-3">
          <Kpi label="Flota" value={String(kpis.fleet)} />
          <Kpi label="Alquilados ahora" value={String(kpis.rentedNow)} />
          <Kpi label="Activos" value={String(kpis.active)} />
        </div>
      </section>

      {/* Resumen del período: todo de Caja (dinero real), coherente entre sí */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-foreground/70">Caja del período</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Finalizados" value={String(kpis.finished)} />
          <Kpi label="Ingresos" value={formatArs(kpis.incomeTotal)} />
          <Kpi label="Egresos" value={formatArs(kpis.expenseTotal)} />
          <Kpi label="Neto" value={formatArs(kpis.netTotal)} tone={kpis.netTotal < 0 ? "bad" : "good"} />
        </div>
        <div className={`grid grid-cols-2 gap-3 ${cashByOwnership.incomeUnclassified > 0 ? "sm:grid-cols-3" : ""}`}>
          <Kpi label="Ingresos — cuenta propia" value={formatArs(cashByOwnership.incomeOwn)} />
          <Kpi label="Ingresos — cuenta ajena" value={formatArs(cashByOwnership.incomeThirdParty)} />
          {cashByOwnership.incomeUnclassified > 0 && (
            <Kpi label="Ingresos — sin clasificar" value={formatArs(cashByOwnership.incomeUnclassified)} />
          )}
        </div>
        <p className="text-xs text-foreground/40">
          Ingresos/Egresos/Neto son los movimientos reales de Caja del período — no el contrato de cada reserva
          (por eso no van a coincidir con la tabla &quot;Por vehículo&quot; de abajo).
          {cashByOwnership.incomeUnclassified > 0 &&
            " \"Sin clasificar\" son ingresos cuyo medio de pago ya se borró."}
        </p>
      </section>

      {/* Actividad por mes */}
      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground/70">Alquileres finalizados por mes</h2>
          <a
            className="text-xs font-medium underline"
            href={`/api/reports/export?type=months&period=${periodParam}`}
          >
            Exportar CSV
          </a>
        </div>
        <MonthBars data={byMonth} highlightMonth={highlightMonth} />
      </section>

      {/* Por vehículo */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground/70">Por vehículo</h2>
          <a
            className="text-xs font-medium underline"
            href={`/api/reports/export?type=vehicles&period=${periodParam}&sort=${sort}&dir=${dir}`}
          >
            Exportar CSV
          </a>
        </div>
        <div className="overflow-x-auto rounded-xl border border-foreground/10">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-foreground/10 text-left text-xs uppercase tracking-wide text-foreground/50">
                <th className="px-3 py-2 font-medium">Vehículo</th>
                {VEHICLE_SORT_KEYS.map((key) => (
                  <th key={key} className="px-3 py-2 text-right font-medium">
                    <a href={sortHref(key)} className="inline-flex items-center gap-1 hover:text-foreground/80">
                      {VEHICLE_SORT_LABELS[key]}
                      {sort === key && <span aria-hidden>{dir === "desc" ? "↓" : "↑"}</span>}
                    </a>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id} className="border-b border-foreground/5 last:border-0">
                  <td className="px-3 py-2">
                    <span className="font-medium">{v.label}</span>
                    <span className="text-foreground/50"> · {v.plate}</span>
                    {v.archived && <span className="ml-1 text-xs text-foreground/40">(archivado)</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{v.rentals}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{v.days.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatArs(v.income)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatArs(v.cost)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${v.net < 0 ? "text-red-600" : ""}`}>{formatArs(v.net)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${v.damages > 0 ? "text-amber-600 font-medium" : ""}`}>{v.damages}</td>
                </tr>
              ))}
              {vehicles.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-foreground/50">Sin datos todavía.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-foreground/40">
          Ingresos del contrato del empleado (o total de la reserva si no hay), no de Caja — atribuido a cada auto,
          por eso no coincide con &quot;Ingresos&quot; de arriba. Costo total de mantenimiento del período:{" "}
          <span className="font-medium text-foreground/60">{formatArs(kpis.costTotal)}</span> (registro aparte, no
          siempre se carga también como egreso en Caja). Sólo alquileres finalizados.
        </p>
      </section>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl border border-foreground/10 p-3">
      <p className="text-xs text-foreground/50">{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${tone === "bad" ? "text-red-600" : tone === "good" ? "text-emerald-600" : ""}`}>{value}</p>
    </div>
  );
}

/** Color de acento cuando la barra corresponde al mes puntual elegido arriba (mes anterior/actual). */
const HIGHLIGHT_COLOR = "#eab308"; // yellow-500

/**
 * Gráfico de barras (SVG) de alquileres finalizados por mes — siempre hasta
 * 12 meses de historia (ver `chartMonthCount`), independiente del período
 * elegido arriba. Si ese período es un mes puntual, `highlightMonth` marca
 * esa barra en amarillo (el resto queda azul); para un rango de N meses no
 * hay barra destacada (no hay un único mes "seleccionado").
 */
function MonthBars({ data, highlightMonth }: { data: MonthPoint[]; highlightMonth: string | null }) {
  const w = 720;
  const h = 180;
  const pad = 24;
  const max = Math.max(1, ...data.map((d) => d.rentals));
  const bw = (w - 2 * pad) / data.length;

  return (
    <div className="overflow-x-auto rounded-xl border border-foreground/10 p-3">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-44 w-full min-w-[420px] text-blue-500" role="img" aria-label="Alquileres por mes">
        {data.map((d, i) => {
          const barH = (d.rentals / max) * (h - 2 * pad);
          const x = pad + i * bw;
          const y = h - pad - barH;
          const isHighlighted = d.month === highlightMonth;
          return (
            <g key={d.month}>
              <rect
                x={x + bw * 0.15}
                y={y}
                width={bw * 0.7}
                height={barH}
                fill={isHighlighted ? HIGHLIGHT_COLOR : "currentColor"}
                fillOpacity="0.7"
                rx="2"
              />
              {d.rentals > 0 && (
                <text x={x + bw / 2} y={y - 3} fontSize="9" textAnchor="middle" fill={isHighlighted ? HIGHLIGHT_COLOR : "currentColor"} fillOpacity={isHighlighted ? 1 : 0.6}>{d.rentals}</text>
              )}
              <text x={x + bw / 2} y={h - 8} fontSize="8" textAnchor="middle" fill={isHighlighted ? HIGHLIGHT_COLOR : "currentColor"} fillOpacity={isHighlighted ? 1 : 0.45}>
                {d.month.slice(5)}/{d.month.slice(2, 4)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
