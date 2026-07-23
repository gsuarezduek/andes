import type { Metadata } from "next";
import { requireUser } from "@/lib/auth-helpers";
import { getCalendarData, normalizeCalendarDays, WEEK_DAYS, MONTH_DAYS } from "@/lib/calendar";
import { ButtonLink } from "@/components/ui/button";
import { CalendarGrid } from "./calendar-grid";

export const metadata: Metadata = { title: "Calendario — Andes" };

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; days?: string }>;
}) {
  await requireUser();
  const { from, days: rawDays } = await searchParams;
  const days = normalizeCalendarDays(rawDays);
  const data = await getCalendarData({ from, days });

  const rangeStart = data.columns[0]?.key;
  const rangeEnd = data.columns[data.columns.length - 1]?.key;
  const nav = (targetFrom: string) => `/calendar?from=${targetFrom}&days=${data.days}`;

  return (
    <div className="ml-[calc(50%-50vw)] flex w-screen flex-col gap-4 px-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendario</h1>
          <p className="text-sm text-foreground/50">
            {fmtRange(rangeStart, rangeEnd)} · {data.days} días
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <ButtonLink href={`/calendar?from=${data.from}&days=${WEEK_DAYS}`} variant={data.days === WEEK_DAYS ? "primary" : "secondary"}>
              Semana
            </ButtonLink>
            <ButtonLink href={`/calendar?from=${data.from}&days=${MONTH_DAYS}`} variant={data.days === MONTH_DAYS ? "primary" : "secondary"}>
              Mes
            </ButtonLink>
          </div>
          <div className="flex items-center gap-2">
            <ButtonLink href={nav(data.prevFrom)} variant="secondary">
              ← Anterior
            </ButtonLink>
            <ButtonLink href={nav(data.todayFrom)} variant="secondary">
              Hoy
            </ButtonLink>
            <ButtonLink href={nav(data.nextFrom)} variant="secondary">
              Siguiente →
            </ButtonLink>
          </div>
        </div>
      </div>

      <CalendarGrid
        columns={data.columns}
        rows={data.rows}
        unassigned={data.unassigned}
      />

      {/* Leyenda de colores de las barras */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground/60">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-green-600/90" /> Activo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-amber-400" /> Confirmado (pagado)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-orange-500/90" /> Pendiente
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-red-600/90" /> Cancelado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-slate-400/90" /> Finalizado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-rose-500/20" /> Fuera de servicio
        </span>
      </div>

      <p className="text-xs text-foreground/40">
        Autos ordenados por su orden de calendario (editable en cada ficha).
        Pasá el mouse por una barra para ver las notas de la reserva.
      </p>
    </div>
  );
}

function fmtRange(start?: string, end?: string): string {
  if (!start || !end) return "";
  const f = (s: string) => {
    const [, m, d] = s.split("-");
    return `${d}/${m}`;
  };
  return `${f(start)} — ${f(end)}`;
}
