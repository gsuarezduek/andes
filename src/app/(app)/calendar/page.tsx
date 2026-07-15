import type { Metadata } from "next";
import { requireUser } from "@/lib/auth-helpers";
import { getCalendarData } from "@/lib/calendar";
import { ButtonLink } from "@/components/ui/button";
import { CalendarGrid } from "./calendar-grid";

export const metadata: Metadata = { title: "Calendario — Andes" };

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  await requireUser();
  const { from } = await searchParams;
  const data = await getCalendarData({ from });

  const rangeStart = data.columns[0]?.key;
  const rangeEnd = data.columns[data.columns.length - 1]?.key;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendario</h1>
          <p className="text-sm text-foreground/50">
            {fmtRange(rangeStart, rangeEnd)} · {data.days} días
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ButtonLink href={`/calendar?from=${data.prevFrom}`} variant="secondary">
            ← Anterior
          </ButtonLink>
          <ButtonLink href={`/calendar?from=${data.todayFrom}`} variant="secondary">
            Hoy
          </ButtonLink>
          <ButtonLink href={`/calendar?from=${data.nextFrom}`} variant="secondary">
            Siguiente →
          </ButtonLink>
        </div>
      </div>

      <CalendarGrid
        columns={data.columns}
        rows={data.rows}
        unassigned={data.unassigned}
      />

      <p className="text-xs text-foreground/40">
        Autos ordenados por su orden de calendario (editable en cada ficha). Se
        muestran los alquileres no cancelados; pasá el mouse por una barra para
        ver las notas de la reserva.
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
