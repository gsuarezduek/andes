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
  type WhatsAppMonthPoint,
  type ConversionMonthPoint,
  type VehicleSortKey,
  type ExpenseCategoryReport,
} from "@/lib/reports";
import { formatArs } from "@/lib/contract";
import { SectionHeading } from "@/components/ui/section-heading";

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

  const { kpis, byMonth, highlightMonth, vehicles: unsortedVehicles, cashByOwnership, expensesByCategory, usdUnconverted, whatsapp } =
    await getReports(period);
  const vehicles = sortVehicleReports(unsortedVehicles, sort, dir);

  /** href de un encabezado de columna: si ya se ordena por esa columna, invierte la dirección. */
  function sortHref(key: VehicleSortKey): string {
    const nextDir = sort === key && dir === "desc" ? "asc" : "desc";
    return `/reports?period=${periodParam}&sort=${key}&dir=${nextDir}`;
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
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
      <section className="flex flex-col gap-3">
        <SectionHeading description="Estado en este momento, no depende del período elegido arriba.">
          Flota (estado actual)
        </SectionHeading>
        <div className="grid grid-cols-3 gap-3">
          <Kpi label="Flota" value={String(kpis.fleet)} />
          <Kpi label="Alquilados ahora" value={String(kpis.rentedNow)} />
          <Kpi label="Activos" value={String(kpis.active)} />
        </div>
      </section>

      {/* Resumen del período: todo de Caja (dinero real), coherente entre sí */}
      <section className="flex flex-col gap-3">
        <SectionHeading>Caja del período</SectionHeading>
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
            " \"Sin clasificar\" son ingresos cuyo medio de pago ya se borró."}{" "}
          Todo va en pesos: los movimientos en USD se convierten con el valor de referencia vigente cuando se cargaron.
          {usdUnconverted > 0 &&
            ` ⚠ ${usdUnconverted} movimiento(s) en USD quedaron afuera porque todavía no hay un valor de referencia cargado (se carga arriba a la derecha en Caja).`}
        </p>
      </section>

      {/* Egresos por categoría */}
      {expensesByCategory.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionHeading description="Egresos del período (Caja), agrupados por categoría.">
            Egresos por categoría
          </SectionHeading>
          <div className="rounded-xl border border-foreground/10 p-4">
            <ExpenseCategoryPie data={expensesByCategory} />
          </div>
        </section>
      )}

      {/* Actividad por mes */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionHeading>Alquileres finalizados por mes</SectionHeading>
          <a
            className="text-xs font-medium underline"
            href={`/api/reports/export?type=months&period=${periodParam}`}
          >
            Exportar CSV
          </a>
        </div>
        <MonthBars data={byMonth} highlightMonth={highlightMonth} />
      </section>

      {/* WhatsApp */}
      <section className="flex flex-col gap-3">
        <SectionHeading description="Conversaciones con al menos un mensaje (entrante o saliente) en el período.">
          WhatsApp
        </SectionHeading>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Kpi label="Conversaciones únicas (período)" value={String(whatsapp.conversationsInPeriod)} />
          <Kpi label="Alquileres finalizados (período)" value={String(kpis.finished)} />
          <Kpi label="Conversión (alquileres / consultas)" value={formatPercent(whatsapp.conversionPercent)} />
        </div>
        <p className="text-xs font-medium text-foreground/60">Conversaciones únicas por mes</p>
        <WhatsAppMonthBars data={whatsapp.byMonth} />
        <p className="text-xs font-medium text-foreground/60">Conversión por mes</p>
        <ConversionTable data={whatsapp.conversionByMonth} />
      </section>

      {/* Por vehículo */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <SectionHeading>Por vehículo</SectionHeading>
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

// Paleta categórica fija (variables definidas en globals.css, con su variante
// para modo oscuro) — orden fijo, nunca se ciclan. Sólo 7 slots "reales":
// `aggregateExpensesByCategory` ya pliega la cola en "Otros" antes de llegar
// acá, que usa el color gris de "--chart-cat-other".
const EXPENSE_CATEGORY_COLOR_VARS = [
  "--chart-cat-1",
  "--chart-cat-2",
  "--chart-cat-3",
  "--chart-cat-4",
  "--chart-cat-5",
  "--chart-cat-6",
  "--chart-cat-7",
];

/** Color de una porción: gris fijo para "Otros"/"Sin categoría" plegada, si no el próximo color de la paleta en orden. */
function expenseSliceColor(index: number, name: string): string {
  if (name === "Otros") return "var(--chart-cat-other)";
  return `var(${EXPENSE_CATEGORY_COLOR_VARS[index % EXPENSE_CATEGORY_COLOR_VARS.length]})`;
}

/** Punto sobre un círculo de radio `r` centrado en (cx, cy), a `angleDeg` grados desde las 12, en sentido horario. */
function pointOnCircle(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/**
 * Gráfico de torta (SVG) de egresos por categoría + lista con nombre/monto/%
 * al lado — la lista dobla como "vista de tabla" (algunos colores de la
 * paleta no llegan a 3:1 de contraste contra el fondo; la lista con valores
 * en texto es la mitigación, nunca depender del color solo).
 */
function ExpenseCategoryPie({ data }: { data: ExpenseCategoryReport[] }) {
  const size = 160;
  const r = 72;
  const cx = size / 2;
  const cy = size / 2;
  const total = data.reduce((sum, d) => sum + d.total, 0);

  const slices = data.reduce<Array<ExpenseCategoryReport & { index: number; startAngle: number; angle: number }>>(
    (acc, d, i) => {
      const angle = total > 0 ? (d.total / total) * 360 : 0;
      const startAngle = acc.length > 0 ? acc[acc.length - 1].startAngle + acc[acc.length - 1].angle : 0;
      acc.push({ ...d, index: i, startAngle, angle });
      return acc;
    },
    [],
  );

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-40 w-40 shrink-0" role="img" aria-label="Egresos por categoría">
        {total <= 0 ? (
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeOpacity="0.1" />
        ) : (
          slices.map((s) => {
            const color = expenseSliceColor(s.index, s.name);
            // Una sola categoría con el 100%: un arco no puede cerrar el círculo completo, se dibuja aparte.
            if (s.angle >= 359.99) {
              return <circle key={s.name + s.index} cx={cx} cy={cy} r={r} fill={color} />;
            }
            const p1 = pointOnCircle(cx, cy, r, s.startAngle);
            const p2 = pointOnCircle(cx, cy, r, s.startAngle + s.angle);
            const largeArc = s.angle > 180 ? 1 : 0;
            const path = `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArc} 1 ${p2.x} ${p2.y} Z`;
            return (
              <path
                key={s.name + s.index}
                d={path}
                fill={color}
                stroke="var(--background)"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            );
          })
        )}
      </svg>
      <ul className="flex w-full min-w-0 flex-col gap-1.5 text-sm">
        {slices.map((s) => (
          <li key={s.name + s.index} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: expenseSliceColor(s.index, s.name) }}
                aria-hidden
              />
              <span className="truncate">{s.name}</span>
            </span>
            <span className="shrink-0 tabular-nums text-foreground/60">
              {formatArs(s.total)} <span className="text-foreground/40">· {s.percent.toFixed(0)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Mismo gráfico de barras que `MonthBars`, pero para conversaciones de WhatsApp por mes (verde, sin mes destacado). */
function WhatsAppMonthBars({ data }: { data: WhatsAppMonthPoint[] }) {
  const w = 720;
  const h = 180;
  const pad = 24;
  const max = Math.max(1, ...data.map((d) => d.conversations));
  const bw = (w - 2 * pad) / data.length;

  return (
    <div className="overflow-x-auto rounded-xl border border-foreground/10 p-3">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-44 w-full min-w-[420px] text-emerald-500" role="img" aria-label="Conversaciones de WhatsApp por mes">
        {data.map((d, i) => {
          const barH = (d.conversations / max) * (h - 2 * pad);
          const x = pad + i * bw;
          const y = h - pad - barH;
          return (
            <g key={d.month}>
              <rect x={x + bw * 0.15} y={y} width={bw * 0.7} height={barH} fill="currentColor" fillOpacity="0.7" rx="2" />
              {d.conversations > 0 && (
                <text x={x + bw / 2} y={y - 3} fontSize="9" textAnchor="middle" fill="currentColor" fillOpacity="0.6">
                  {d.conversations}
                </text>
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

function formatPercent(value: number | null): string {
  return value == null ? "—" : `${value.toFixed(1).replace(".", ",")}%`;
}

/** Seguimiento mes a mes: consultas, alquileres finalizados y % de conversión (más reciente arriba). */
function ConversionTable({ data }: { data: ConversionMonthPoint[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-foreground/10">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-foreground/60">
          <tr>
            <th className="px-3 py-2 font-medium">Mes</th>
            <th className="px-3 py-2 text-right font-medium">Consultas</th>
            <th className="px-3 py-2 text-right font-medium">Alquileres</th>
            <th className="px-3 py-2 text-right font-medium">Conversión</th>
          </tr>
        </thead>
        <tbody>
          {[...data].reverse().map((d) => (
            <tr key={d.month} className="border-t border-foreground/10">
              <td className="px-3 py-2">
                {d.month.slice(5)}/{d.month.slice(0, 4)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{d.conversations}</td>
              <td className="px-3 py-2 text-right tabular-nums">{d.rentals}</td>
              <td className="px-3 py-2 text-right font-medium tabular-nums">{formatPercent(d.percent)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
