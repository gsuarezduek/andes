import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth-helpers";
import { formatDateInput, formatDateTime } from "@/lib/datetime";
import { addDaysToKey } from "@/lib/rooms/ical";
import { normalizeWeek, shiftLabels, type Shift } from "@/lib/schedule";
import { getPreviousWeekAsCurrent, getScheduleChanges, getWeekSchedule } from "@/lib/schedule-queries";
import { ButtonLink } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { AutoRefresh } from "@/components/auto-refresh";
import { WeekScheduleGrid } from "@/components/schedule/week-schedule-grid";
import { WeekEditor } from "@/components/schedule/week-editor";

export const metadata: Metadata = { title: "Horarios — Andes" };

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "2026-09-21" + "2026-09-27" → "21 al 27 de septiembre" (o "28 de sep al 4 de oct" si cruza mes). */
function weekLabel(start: string, end: string): string {
  const [, sm, sd] = start.split("-").map(Number);
  const [, em, ed] = end.split("-").map(Number);
  return sm === em ? `${sd} al ${ed} de ${MONTHS[em - 1]}` : `${sd} de ${MONTHS[sm - 1].slice(0, 3)} al ${ed} de ${MONTHS[em - 1].slice(0, 3)}`;
}

const fmtKey = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;
const shiftOrFree = (s: Shift | null) => (s ? shiftLabels[s] : "Libre");

export default async function HorariosPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const todayKey = formatDateInput(new Date());
  const weekStart = normalizeWeek((await searchParams).week, todayKey);
  const schedule = await getWeekSchedule(weekStart);
  const currentWeek = normalizeWeek(undefined, todayKey);

  const nav = (target: string) => `/horarios?week=${target}`;
  const people = schedule.people.map((p) => ({ id: p.id, name: p.name }));

  const [previous, changes] = isAdmin
    ? await Promise.all([getPreviousWeekAsCurrent(weekStart, people.map((p) => p.id)), getScheduleChanges()])
    : [{}, []];
  const initial = Object.fromEntries(
    schedule.people.flatMap((p) => schedule.days.map((d) => [`${p.id}|${d.key}`, p.shifts[d.key] ?? ""] as const)),
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Horarios</h1>
          <p className="text-sm text-foreground/60">
            Semana del {weekLabel(weekStart, addDaysToKey(weekStart, 6))}
            {weekStart === currentWeek ? " (esta semana)" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ButtonLink href={nav(addDaysToKey(weekStart, -7))} variant="secondary">
            ← Anterior
          </ButtonLink>
          <ButtonLink href="/horarios" variant="secondary">
            Hoy
          </ButtonLink>
          <ButtonLink href={nav(addDaysToKey(weekStart, 7))} variant="secondary">
            Siguiente →
          </ButtonLink>
        </div>
      </div>

      {people.length === 0 ? (
        <p className="rounded-lg border border-foreground/10 px-4 py-6 text-center text-sm text-foreground/60">
          Todavía nadie tiene horario.{" "}
          {isAdmin ? (
            <>
              Tildá «Con horario» en la ficha de cada persona, en{" "}
              <Link href="/users" className="underline">
                Usuarios
              </Link>
              .
            </>
          ) : null}
        </p>
      ) : (
        <WeekScheduleGrid schedule={schedule} />
      )}

      {isAdmin && people.length > 0 ? (
        <section className="flex flex-col gap-3">
          <SectionHeading description="Elegí el turno de cada persona por día; sin turno = día libre. Se pueden cargar semanas futuras y corregir la actual.">
            Editar semana
          </SectionHeading>
          <WeekEditor
            key={weekStart}
            weekStart={weekStart}
            days={schedule.days}
            people={people}
            initial={initial}
            previous={previous}
          />
        </section>
      ) : null}

      {isAdmin && changes.length > 0 ? (
        <details className="rounded-xl border border-foreground/10">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Historial de cambios ({changes.length})</summary>
          <ul className="divide-y divide-foreground/10 border-t border-foreground/10 text-sm">
            {changes.map((c) => (
              <li key={c.id} className="px-4 py-2.5">
                <p>
                  <span className="font-medium">{c.userName}</span> · {fmtKey(c.date)}: {shiftOrFree(c.from)} → {shiftOrFree(c.to)}
                </p>
                <p className="text-xs text-foreground/50">
                  {c.changedByName} · {formatDateTime(c.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {/* Los colores dependen de la hora: se refrescan solos. */}
      <AutoRefresh intervalMs={300_000} />
    </div>
  );
}
