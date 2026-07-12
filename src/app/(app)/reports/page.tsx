import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-helpers";
import { getReports, type MonthPoint } from "@/lib/reports";
import { formatArs } from "@/lib/contract";

export const metadata: Metadata = { title: "Reportes — Andes" };

export default async function ReportsPage() {
  await requireAdmin();
  const { kpis, byMonth, vehicles } = await getReports();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Reportes</h1>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Flota" value={String(kpis.fleet)} />
        <Kpi label="Alquilados ahora" value={String(kpis.rentedNow)} />
        <Kpi label="Activos" value={String(kpis.active)} />
        <Kpi label="Finalizados" value={String(kpis.finished)} />
        <Kpi label="Ingresos" value={formatArs(kpis.incomeTotal)} />
        <Kpi label="Neto (− costos)" value={formatArs(kpis.netTotal)} tone={kpis.netTotal < 0 ? "bad" : "good"} />
      </div>

      {/* Actividad por mes */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground/70">Alquileres finalizados por mes</h2>
          <a className="text-xs font-medium underline" href="/api/reports/export?type=months">Exportar CSV</a>
        </div>
        <MonthBars data={byMonth} />
      </section>

      {/* Por vehículo */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground/70">Por vehículo</h2>
          <a className="text-xs font-medium underline" href="/api/reports/export?type=vehicles">Exportar CSV</a>
        </div>
        <div className="overflow-x-auto rounded-xl border border-foreground/10">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-foreground/10 text-left text-xs uppercase tracking-wide text-foreground/50">
                <th className="px-3 py-2 font-medium">Vehículo</th>
                <th className="px-3 py-2 text-right font-medium">Alquileres</th>
                <th className="px-3 py-2 text-right font-medium">Ingresos</th>
                <th className="px-3 py-2 text-right font-medium">Costos</th>
                <th className="px-3 py-2 text-right font-medium">Neto</th>
                <th className="px-3 py-2 text-right font-medium">Daños activos</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id} className="border-b border-foreground/5 last:border-0">
                  <td className="px-3 py-2">
                    <span className="font-medium">{v.label}</span>
                    <span className="text-foreground/50"> · {v.plate}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{v.rentals}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatArs(v.income)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatArs(v.cost)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${v.net < 0 ? "text-red-600" : ""}`}>{formatArs(v.net)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${v.damages > 0 ? "text-amber-600 font-medium" : ""}`}>{v.damages}</td>
                </tr>
              ))}
              {vehicles.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-foreground/50">Sin datos todavía.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-foreground/40">
          Ingresos del contrato del empleado (o total de la reserva si no hay); costos del registro de mantenimiento. Sólo alquileres finalizados.
        </p>
      </section>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl border border-foreground/10 p-3">
      <p className="text-xs text-foreground/50">{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${tone === "bad" ? "text-red-600" : tone === "good" ? "text-green-600" : ""}`}>{value}</p>
    </div>
  );
}

/** Gráfico de barras (SVG) de alquileres finalizados por mes (últimos 12). */
function MonthBars({ data }: { data: MonthPoint[] }) {
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
          return (
            <g key={d.month}>
              <rect x={x + bw * 0.15} y={y} width={bw * 0.7} height={barH} fill="currentColor" fillOpacity="0.7" rx="2" />
              {d.rentals > 0 && (
                <text x={x + bw / 2} y={y - 3} fontSize="9" textAnchor="middle" fill="currentColor" fillOpacity="0.6">{d.rentals}</text>
              )}
              <text x={x + bw / 2} y={h - 8} fontSize="8" textAnchor="middle" fill="currentColor" fillOpacity="0.45">
                {d.month.slice(5)}/{d.month.slice(2, 4)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
