import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-helpers";
import {
  getReports,
  sortVehicleReports,
  parseReportPeriod,
  reportPeriodParam,
  reportPeriodLabel,
  REPORT_PERIOD_OPTIONS,
  DEFAULT_VEHICLE_SORT,
  VEHICLE_SORT_KEYS,
  type ConversionMonthPoint,
  type OccupancyMonthPoint,
  type VehicleSortKey,
  type ExpenseCategoryReport,
} from "@/lib/reports";
import { formatArs } from "@/lib/contract";
import { formatDuration } from "@/lib/reports-metrics";
import { SectionHeading } from "@/components/ui/section-heading";
import { MonthlyReportButton } from "@/components/reports/monthly-report-button";
import { sendMonthlyReport } from "./actions";

export const metadata: Metadata = { title: "Reportes — Andes" };

const VEHICLE_SORT_LABELS: Record<VehicleSortKey, string> = {
  rentals: "Alquileres",
  days: "Días alquilado",
  occupancyPercent: "Ocupación",
  income: "Ingresos",
  incomePerDay: "Ingreso/día",
  cost: "Costos",
  costPercent: "Costo/ingreso",
  net: "Neto",
  netPerDay: "Neto/día",
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
  const sort = (VEHICLE_SORT_KEYS as readonly string[]).includes(rawSort ?? "")
    ? (rawSort as VehicleSortKey)
    : DEFAULT_VEHICLE_SORT;
  const dir = rawDir === "asc" ? "asc" : "desc";

  const { kpis, byMonth, highlightMonth, vehicles: unsortedVehicles, cashByOwnership, expensesByCategory, usdUnconverted, whatsapp, occupancy, revenue, extras, bookings } =
    await getReports(period);
  const vehicles = sortVehicleReports(unsortedVehicles, sort, dir);

  // "Mes ya cerrado": el único caso de ReportPeriod que es un mes puntual que
  // ya terminó — el mes actual sigue en curso y un rango de N meses no es
  // "un mes". El informe con IA sólo tiene sentido sobre un mes cerrado.
  const isClosedMonth = period.kind === "month" && period.which === "previous";

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

      {isClosedMonth && <MonthlyReportButton period={period} sendMonthlyReport={sendMonthlyReport} />}

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

      {/* Ocupación y rentabilidad */}
      <section className="flex flex-col gap-3">
        <SectionHeading description="Qué tan usada está la flota y cuánto rinde cada día alquilado.">
          Ocupación y rentabilidad
        </SectionHeading>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Kpi
            label="Ocupación de la flota"
            value={formatPercent(occupancy.percent)}
            hint={`${occupancy.rentedDays.toFixed(0)} de ${occupancy.availableDays.toFixed(0)} días (${occupancy.fleetUnits} autos)`}
          />
          <Kpi label="Flota activa" value={String(occupancy.activeFleetUnits)} hint={`de ${occupancy.fleetUnits} autos`} />
          <Kpi label="Ingreso por día alquilado" value={formatMoneyOrDash(revenue.perRentedDay)} />
          <Kpi label="Ticket promedio" value={formatMoneyOrDash(revenue.averageTicket)} hint="por alquiler finalizado" />
          <Kpi
            label="Duración promedio"
            value={revenue.averageDays == null ? "—" : `${revenue.averageDays.toFixed(1).replace(".", ",")} días`}
          />
        </div>
        <p className="text-xs text-foreground/40">
          Ocupación = días alquilados (de la entrega a la devolución, incluidos los alquileres en curso) sobre los días
          disponibles de la flota actual sin archivados. Flota activa = autos distintos que tuvieron algún alquiler en
          el período (no cuántos días). Ingreso por día, ticket y duración son de los alquileres finalizados del
          período y usan el ingreso del contrato, no Caja.
        </p>
        <p className="text-xs font-medium text-foreground/60">Ocupación de la flota por mes</p>
        <OccupancyTrendChart data={occupancy.byMonth} />
      </section>

      {/* Extras de la devolución */}
      <section className="flex flex-col gap-3">
        <SectionHeading description="Lo liquidado en las devoluciones del período aparte de la tarifa.">
          Extras de la devolución
        </SectionHeading>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Kpi label="Total de extras" value={formatArs(extras.total)} />
          <Kpi label="Promedio por alquiler" value={formatMoneyOrDash(extras.perRental)} />
          <Kpi label="Sobre los ingresos" value={formatPercent(extras.percentOfIncome)} />
          <Kpi label="Km extra" value={formatArs(extras.km)} />
          <Kpi label="Nafta" value={formatArs(extras.fuel)} />
          <Kpi label="Daños" value={formatArs(extras.damages)} />
        </div>
        <p className="text-xs text-foreground/40">
          Son los importes de la liquidación que firma el cliente (km extra, nafta y daños); no necesariamente ya cobrados.
        </p>
      </section>

      {/* Reservas */}
      <section className="flex flex-col gap-3">
        <SectionHeading description="Reservas cuyo retiro cae en el período (sin los bloqueos por service/arreglo).">
          Reservas
        </SectionHeading>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Reservas del período" value={String(bookings.total)} />
          <Kpi
            label="Canceladas"
            value={formatPercent(bookings.cancellationPercent)}
            hint={`${bookings.cancelled} de ${bookings.total}`}
          />
          <Kpi label="Sin confirmar (próximas)" value={String(bookings.pendingConfirmation)} hint="estado de hoy" />
          <Kpi
            label="Anticipación promedio"
            value={bookings.leadTime.averageDays == null ? "—" : `${bookings.leadTime.averageDays.toFixed(1).replace(".", ",")} días`}
            hint={
              bookings.leadTime.medianDays == null
                ? undefined
                : `mediana ${bookings.leadTime.medianDays.toFixed(0)} días`
            }
          />
        </div>
        {bookings.leadTime.withData > 0 && (
          <div className="rounded-xl border border-foreground/10 p-3">
            <p className="mb-2 text-xs font-medium text-foreground/60">
              Con cuánta anticipación se reserva ({bookings.leadTime.withData} reservas con fecha de carga)
            </p>
            <ul className="flex flex-col gap-1.5 text-sm">
              {bookings.leadTime.buckets.map((b) => {
                const pct = (b.count / bookings.leadTime.withData) * 100;
                return (
                  <li key={b.label} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-foreground/70">{b.label}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-foreground/10" aria-hidden>
                      <span className="block h-full rounded-full bg-blue-500/70" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="w-20 shrink-0 text-right tabular-nums text-foreground/60">
                      {b.count} · {pct.toFixed(0)}%
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <p className="text-xs text-foreground/40">
          Cancelación = reservas canceladas sobre todas las del período. La anticipación (retiro menos fecha de carga) solo
          se conoce en las reservas importadas de VikRentCar; las cargadas a mano no cuentan.
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
          <SectionHeading>Actividad por mes</SectionHeading>
          <a
            className="text-xs font-medium underline"
            href={`/api/reports/export?type=months&period=${periodParam}`}
          >
            Exportar CSV
          </a>
        </div>
        <p className="text-xs font-medium text-foreground/60">Alquileres finalizados</p>
        <MonthBarChart
          data={byMonth.map((d) => ({ month: d.month, value: d.rentals }))}
          colorClass="text-blue-500"
          highlightMonth={highlightMonth}
        />
        <p className="text-xs font-medium text-foreground/60">Ingresos</p>
        <MonthBarChart
          data={byMonth.map((d) => ({ month: d.month, value: d.income }))}
          colorClass="text-indigo-500"
          formatValue={compactNumber}
          highlightMonth={highlightMonth}
        />
        <p className="text-xs font-medium text-foreground/60">Extras liquidados (km extra + nafta + daños)</p>
        <MonthBarChart
          data={byMonth.map((d) => ({ month: d.month, value: d.extrasTotal }))}
          colorClass="text-amber-500"
          formatValue={compactNumber}
          highlightMonth={highlightMonth}
        />
      </section>

      {/* WhatsApp */}
      <section className="flex flex-col gap-3">
        <SectionHeading description="Conversaciones con al menos un mensaje (entrante o saliente) en el período.">
          WhatsApp
        </SectionHeading>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Kpi label="Conversaciones únicas (período)" value={String(whatsapp.conversationsInPeriod)} />
          <Kpi label="Conversión (alquileres / consultas)" value={formatPercent(whatsapp.conversionPercent)} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi
            label="Respuesta (mediana)"
            value={formatDuration(whatsapp.response.medianMinutes)}
            hint={`promedio ${formatDuration(whatsapp.response.averageMinutes)} · ${whatsapp.response.waits} consultas`}
          />
          <Kpi
            label="Respuesta humana (mediana)"
            value={formatDuration(whatsapp.response.humanMedianMinutes)}
            hint={`${whatsapp.response.humanWaits} respondidas por el equipo`}
          />
          <Kpi label="Sin respuesta" value={String(whatsapp.response.unanswered)} tone={whatsapp.response.unanswered > 0 ? "bad" : undefined} />
        </div>
        <p className="text-xs text-foreground/40">
          Tiempo desde que el cliente escribe hasta el siguiente mensaje nuestro (bot, equipo desde Andes o desde la app de
          WhatsApp), corrido las 24 hs — incluye noches y fines de semana. Varios mensajes seguidos del cliente cuentan como
          una sola consulta.
        </p>
        <p className="text-xs font-medium text-foreground/60">Conversaciones y conversión por mes</p>
        <WhatsAppTrendChart data={whatsapp.conversionByMonth} />
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
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b border-foreground/10 text-left text-xs uppercase tracking-wide text-foreground/50">
                <th className="px-3 py-2 font-medium">Vehículo</th>
                {VEHICLE_SORT_KEYS.map((key) => (
                  <th key={key} className="px-3 py-2 text-right font-medium">
                    <Link href={sortHref(key)} scroll={false} className="inline-flex items-center gap-1 hover:text-foreground/80">
                      {VEHICLE_SORT_LABELS[key]}
                      {sort === key && <span aria-hidden>{dir === "desc" ? "↓" : "↑"}</span>}
                    </Link>
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
                  <td className="px-3 py-2 text-right tabular-nums">{v.occupancyPercent.toFixed(0)}%</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatArs(v.income)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{v.days > 0 ? formatArs(v.incomePerDay) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatArs(v.cost)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{v.income > 0 ? formatPercent(v.costPercent) : "—"}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${v.net < 0 ? "text-red-600" : ""}`}>{formatArs(v.net)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${v.netPerDay < 0 ? "text-red-600" : ""}`}>{v.days > 0 ? formatArs(v.netPerDay) : "—"}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${v.damages > 0 ? "text-amber-600 font-medium" : ""}`}>{v.damages}</td>
                </tr>
              ))}
              {vehicles.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-3 py-6 text-center text-foreground/50">Sin datos todavía.</td>
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

function Kpi({ label, value, tone, hint }: { label: string; value: string; tone?: "good" | "bad"; hint?: string }) {
  return (
    <div className="rounded-xl border border-foreground/10 p-3">
      <p className="text-xs text-foreground/50">{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${tone === "bad" ? "text-red-600" : tone === "good" ? "text-emerald-600" : ""}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-foreground/40">{hint}</p>}
    </div>
  );
}

/** Color de acento cuando la barra corresponde al mes puntual elegido arriba (mes anterior/actual). */
const HIGHLIGHT_COLOR = "#eab308"; // yellow-500

/** Compacta un número grande para la etiqueta arriba de una barra (ej. 1.234.567 → "1,2M", 45.000 → "45k"). */
function compactNumber(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (abs >= 1_000) return `${Math.round(v / 1000)}k`;
  return String(Math.round(v));
}

/**
 * Gráfico de barras (SVG) genérico por mes — usado para "Alquileres
 * finalizados", "Ingresos" y "Extras liquidados" (antes era un componente
 * por métrica, casi idéntico salvo el color y el formato del valor).
 * `highlightMonth` marca en amarillo la barra del mes puntual elegido arriba
 * (mes anterior/actual); para un rango de N meses no hay barra destacada.
 */
function MonthBarChart({
  data,
  colorClass,
  formatValue = String,
  highlightMonth,
}: {
  data: { month: string; value: number }[];
  colorClass: string;
  formatValue?: (v: number) => string;
  highlightMonth?: string | null;
}) {
  const w = 720;
  const h = 180;
  const pad = 24;
  const max = Math.max(1, ...data.map((d) => d.value));
  const bw = (w - 2 * pad) / data.length;

  return (
    <div className="overflow-x-auto rounded-xl border border-foreground/10 p-3">
      <svg viewBox={`0 0 ${w} ${h}`} className={`h-44 w-full min-w-[420px] ${colorClass}`} role="img" aria-label="Gráfico de barras por mes">
        {data.map((d, i) => {
          const barH = (d.value / max) * (h - 2 * pad);
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
              {d.value > 0 && (
                <text x={x + bw / 2} y={y - 3} fontSize="9" textAnchor="middle" fill={isHighlighted ? HIGHLIGHT_COLOR : "currentColor"} fillOpacity={isHighlighted ? 1 : 0.6}>
                  {formatValue(d.value)}
                </text>
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

/**
 * Gráfico de línea (SVG) de ocupación % por mes — contextualiza el % puntual
 * de "Ocupación y rentabilidad" con la misma ventana de meses que el resto.
 */
function OccupancyTrendChart({ data }: { data: OccupancyMonthPoint[] }) {
  const w = 720;
  const h = 140;
  const pad = 24;
  const bw = (w - 2 * pad) / Math.max(1, data.length - 1);
  const points = data.map((d, i) => {
    const v = Math.min(100, d.percent ?? 0);
    return { x: pad + i * bw, y: h - pad - (v / 100) * (h - 2 * pad), d };
  });
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <div className="overflow-x-auto rounded-xl border border-foreground/10 p-3">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-36 w-full min-w-[420px] text-sky-500" role="img" aria-label="Ocupación de la flota por mes">
        <path d={path} fill="none" stroke="currentColor" strokeWidth="2" strokeOpacity="0.8" />
        {points.map((p) => (
          <g key={p.d.month}>
            <circle cx={p.x} cy={p.y} r="2.5" fill="currentColor" />
            {p.d.percent != null && (
              <text x={p.x} y={p.y - 6} fontSize="9" textAnchor="middle" fill="currentColor" fillOpacity="0.7">
                {p.d.percent.toFixed(0)}%
              </text>
            )}
            <text x={p.x} y={h - 6} fontSize="8" textAnchor="middle" fill="currentColor" fillOpacity="0.45">
              {p.d.month.slice(5)}/{p.d.month.slice(2, 4)}
            </text>
          </g>
        ))}
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

function formatMoneyOrDash(value: number | null): string {
  return value == null ? "—" : formatArs(value);
}

function formatPercent(value: number | null): string {
  return value == null ? "—" : `${value.toFixed(1).replace(".", ",")}%`;
}

/**
 * Gráfico de líneas (SVG) con dos series sobre el mismo eje de meses:
 * conversaciones de WhatsApp (verde, escala propia) y % de conversión (azul,
 * escala 0–100 o más si algún mes superó el 100%). Reemplaza el gráfico de
 * barras + la tabla que estaban separados.
 */
function WhatsAppTrendChart({ data }: { data: ConversionMonthPoint[] }) {
  const w = 720;
  const h = 180;
  const pad = 24;
  const bw = (w - 2 * pad) / Math.max(1, data.length - 1);
  const maxConversations = Math.max(1, ...data.map((d) => d.conversations));
  const maxPercent = Math.max(100, ...data.map((d) => d.percent ?? 0));

  const convPoints = data.map((d, i) => ({
    x: pad + i * bw,
    y: h - pad - (d.conversations / maxConversations) * (h - 2 * pad),
  }));
  const percentPoints = data.map((d, i) => ({
    x: pad + i * bw,
    y: h - pad - ((d.percent ?? 0) / maxPercent) * (h - 2 * pad),
  }));
  const linePath = (pts: { x: number; y: number }[]) => pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <div className="overflow-x-auto rounded-xl border border-foreground/10 p-3">
      <div className="mb-2 flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5 text-emerald-600">
          <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden /> Conversaciones
        </span>
        <span className="flex items-center gap-1.5 text-blue-600">
          <span className="h-2 w-2 rounded-full bg-blue-500" aria-hidden /> Conversión %
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-44 w-full min-w-[420px]" role="img" aria-label="Conversaciones y conversión de WhatsApp por mes">
        <path d={linePath(convPoints)} fill="none" stroke="#10b981" strokeWidth="2" strokeOpacity="0.85" />
        <path d={linePath(percentPoints)} fill="none" stroke="#3b82f6" strokeWidth="2" strokeOpacity="0.85" />
        {data.map((d, i) => (
          <g key={d.month}>
            <circle cx={convPoints[i].x} cy={convPoints[i].y} r="2.5" fill="#10b981" />
            {d.conversations > 0 && (
              <text x={convPoints[i].x} y={convPoints[i].y - 6} fontSize="9" textAnchor="middle" fill="#10b981">
                {d.conversations}
              </text>
            )}
            <circle cx={percentPoints[i].x} cy={percentPoints[i].y} r="2.5" fill="#3b82f6" />
            {d.percent != null && (
              <text x={percentPoints[i].x} y={percentPoints[i].y + 12} fontSize="9" textAnchor="middle" fill="#3b82f6">
                {d.percent.toFixed(0)}%
              </text>
            )}
            <text x={convPoints[i].x} y={h - 8} fontSize="8" textAnchor="middle" fill="currentColor" fillOpacity="0.45">
              {d.month.slice(5)}/{d.month.slice(2, 4)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
