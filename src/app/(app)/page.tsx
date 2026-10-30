import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";
import { hasAdminAccess } from "@/lib/user-permissions";
import { getDashboardData } from "@/lib/dashboard";
import { getRentalPickerOptions } from "@/lib/cash";
import { formatMoney } from "@/lib/contract";
import { getHomeTasks, isTaskOverdue, isTaskDueToday } from "@/lib/tasks";
import { ButtonLink } from "@/components/ui/button";
import { HomeSearch } from "@/components/home-search";
import { formatDateTime, formatTime } from "@/lib/datetime";
import { paymentBorderClass } from "@/lib/rental-ui";
import { computeRentalPayments, paymentAccent } from "@/lib/rental-payments";
import { vehicleDisplayName, vehicleLabelWithPlate } from "@/lib/vehicle-ui";
import { normalizeAgendaDay } from "@/lib/agenda";
import { getAgenda } from "@/lib/agenda-queries";
import { AgendaSection } from "@/components/home/agenda-section";
import { formatDateInput } from "@/lib/datetime";
import { normalizeWeek, weekLabel } from "@/lib/schedule";
import { addDaysToKey } from "@/lib/rooms/ical";
import { getWeekSchedule } from "@/lib/schedule-queries";
import { WeekScheduleGrid } from "@/components/schedule/week-schedule-grid";
import { AutoRefresh } from "@/components/auto-refresh";
import { ChevronRightIcon } from "@/components/ui/icons";
import { HomeTaskList } from "@/components/home/home-task-list";
import { SnoozeServiceButton } from "@/components/vehicle/snooze-service-button";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-foreground/10 px-4 py-3 text-sm text-foreground/50">
      {children}
    </p>
  );
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ week?: string; day?: string }> }) {
  const user = await requireUser();
  const now = new Date();
  const todayKey = formatDateInput(now);
  const params = await searchParams;
  const currentWeek = normalizeWeek(undefined, todayKey);
  const weekStart = normalizeWeek(params.week, todayKey);
  const agendaDay = normalizeAgendaDay(params.day, todayKey);
  const [{ fleet, alerts }, rentalOptions, tasks, schedule, agenda] = await Promise.all([
    getDashboardData(),
    getRentalPickerOptions(),
    getHomeTasks(user.id),
    getWeekSchedule(weekStart),
    getAgenda(agendaDay, now),
  ]);
  // La agenda (`?day=`) y los horarios (`?week=`) navegan por separado: cada
  // link conserva lo que el otro tenga elegido.
  const homeHref = (next: { day?: string; week?: string }) => {
    const q = new URLSearchParams();
    const day = next.day ?? agendaDay;
    const week = next.week ?? weekStart;
    if (day !== todayKey) q.set("day", day);
    if (week !== currentWeek) q.set("week", week);
    const qs = q.toString();
    return qs ? `/?${qs}` : "/";
  };
  const hasAlerts =
    alerts.overdueReturns.length > 0 ||
    alerts.upcomingServices.length > 0 ||
    alerts.unassigned.length > 0 ||
    alerts.unpaidFinished.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Hola, {user.name?.split(" ")[0] ?? "equipo"}</h1>
        <p className="text-sm text-foreground/60">Agenda del día y estado de la flota.</p>
      </div>

      {/* Buscador + acceso rápido: la pantalla más usada del día no debería
          obligar a pasar por /rentals para nada que no sea "hoy". */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex-1">
          <HomeSearch options={rentalOptions} />
        </div>
        <ButtonLink href="/rentals/new" className="shrink-0">
          + Alquiler manual
        </ButtonLink>
      </div>

      {/* ALERTAS: arriba de todo — es lo que más necesita atención al entrar.
          Sin alertas no se muestra la sección, para no ocupar espacio. */}
      {hasAlerts && (
        <Section title="Alertas">
          <div className="flex flex-col gap-3">
            {alerts.unpaidFinished.map((r) => (
              <Link key={r.id} href={`/rentals/${r.id}`} className="flex items-center justify-between gap-3 rounded-lg border-2 border-red-500 bg-red-500/10 px-4 py-3 text-sm">
                <span className="font-bold text-red-700 dark:text-red-400">Urgente: reserva terminada con pago pendiente</span>
                <span className="text-right text-foreground/70">
                  {r.clientName} · {r.vehicleLabel} · falta {formatMoney(r.balance, "ars")}
                </span>
              </Link>
            ))}
            {alerts.overdueReturns.map((r) => (
              <Link key={r.id} href={`/rentals/${r.id}`} className="flex items-center justify-between rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm">
                <span className="font-medium text-red-700 dark:text-red-400">Devolución vencida</span>
                <span className="text-right text-foreground/70">
                  {r.clientName}{r.vehicle ? ` · ${vehicleDisplayName(r.vehicle)}` : ""} · venció {formatDateTime(r.endAt)}
                </span>
              </Link>
            ))}
            {alerts.upcomingServices.map((v) => (
              <div
                key={v.id}
                className={`flex items-center gap-2 rounded-lg border py-2 pl-4 pr-2 text-sm ${v.critical ? "border-red-500/30 bg-red-500/5" : "border-amber-500/30 bg-amber-500/5"}`}
              >
                <Link href={`/vehicles/${v.id}`} className="flex min-w-0 flex-1 items-center justify-between gap-3 py-1">
                  <span className={`font-medium ${v.critical ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}`}>
                    {v.overdue ? "Service vencido" : "Service próximo"}
                  </span>
                  <span className="text-right text-foreground/70">
                    {vehicleDisplayName(v)} · {v.currentKm.toLocaleString("es-AR")} / {v.nextServiceKm?.toLocaleString("es-AR")} km
                  </span>
                </Link>
                <SnoozeServiceButton vehicleId={v.id} vehicleLabel={vehicleDisplayName(v)} />
              </div>
            ))}
            {alerts.unassigned.map((r) => (
              <Link key={r.id} href={`/rentals/${r.id}`} className="flex items-center justify-between rounded-lg border border-foreground/15 px-4 py-3 text-sm">
                <span className="font-medium">Reserva sin vehículo</span>
                <span className="text-right text-foreground/70">
                  {r.clientName} · retiro {formatDateTime(r.startAt)}
                </span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {/* HORARIOS DE LA SEMANA: quién está en turno ahora (verde) o activo en otro horario (azul).
          Colapsado por defecto (ocupaba mucho lugar en el Home); título + navegación de semana
          siempre visibles, la grilla se abre al tocar. */}
      {schedule.people.length > 0 || hasAdminAccess(user.role) ? (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">Horarios de la semana</h2>
            <div className="flex items-center gap-0.5">
              <Link
                href={homeHref({ week: addDaysToKey(weekStart, -7) })}
                aria-label="Semana anterior"
                className="rounded-md p-1 text-foreground/50 transition-colors hover:bg-foreground/5 hover:text-foreground"
              >
                <ChevronRightIcon className="size-4 rotate-180" />
              </Link>
              {weekStart !== currentWeek ? (
                <Link href={homeHref({ week: currentWeek })} className="px-1 text-[11px] font-medium text-foreground/50 underline">
                  Hoy
                </Link>
              ) : null}
              <Link
                href={homeHref({ week: addDaysToKey(weekStart, 7) })}
                aria-label="Semana siguiente"
                className="rounded-md p-1 text-foreground/50 transition-colors hover:bg-foreground/5 hover:text-foreground"
              >
                <ChevronRightIcon className="size-4" />
              </Link>
            </div>
          </div>
          {schedule.people.length === 0 ? (
            <Empty>
              Nadie tiene horario todavía. Tildá «Con horario» en la ficha de cada persona, en{" "}
              <Link href="/users" className="underline">
                Usuarios
              </Link>
              .
            </Empty>
          ) : weekStart === currentWeek ? (
            // Semana actual (el caso por defecto): sin la barra de "Esta
            // semana" + chevron — era una fila entera solo para decir algo
            // ya obvio por contexto.
            <div className="rounded-xl border border-foreground/10 p-2">
              <WeekScheduleGrid schedule={schedule} currentUserId={user.id} />
            </div>
          ) : (
            <details open className="group rounded-xl border border-foreground/10">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
                <span>{weekLabel(weekStart, addDaysToKey(weekStart, 6))}</span>
                <span className="text-foreground/40 transition-transform group-open:rotate-180" aria-hidden>
                  ▾
                </span>
              </summary>
              <div className="border-t border-foreground/10 p-2">
                <WeekScheduleGrid schedule={schedule} currentUserId={user.id} />
              </div>
            </details>
          )}
          <Link href="/horarios" className="self-start text-xs font-medium text-foreground/60 underline">
            {hasAdminAccess(user.role) ? "Ver y editar horarios →" : "Ver horarios de otras semanas →"}
          </Link>
          {/* Los colores dependen de la hora: se refrescan solos. */}
          <AutoRefresh intervalMs={300_000} />
        </section>
      ) : null}

      {/* AGENDA: entregas, devoluciones, tareas con agenda y check-in por
          horario; aparte, lo que pasa en la oficina sin salir. Hoy por
          defecto, navegable día por día. */}
      <AgendaSection
        agenda={agenda}
        dayKey={agendaDay}
        todayKey={todayKey}
        nowTime={formatTime(now)}
        dayHref={(day) => homeHref({ day })}
      />
      {/* El estado (pendiente/demorada) y la línea de "ahora" dependen de la hora. */}
      <AutoRefresh intervalMs={120_000} />

      {/* TAREAS: mis pendientes + las de cualquiera que vencen hoy o ya vencieron. */}
      <Section title={`Tareas (${tasks.length})`}>
        {tasks.length === 0 ? (
          <Empty>No hay tareas pendientes para hoy.</Empty>
        ) : (
          <HomeTaskList
            key={tasks.map((t) => t.id).join(",")}
            tasks={tasks.map((task) => ({
              task,
              overdue: isTaskOverdue(task),
              dueToday: isTaskDueToday(task),
            }))}
          />
        )}
        <Link href="/tasks" className="self-start text-xs font-medium text-foreground/60 underline">
          Ver todas las tareas →
        </Link>
      </Section>

      {/* FLOTA */}
      <Section title="Flota">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-foreground/10 p-4">
                <p className="text-2xl font-bold">{fleet.counts.available}</p>
                <p className="text-xs text-foreground/60">Disponibles</p>
              </div>
              <div className="rounded-xl border border-foreground/10 p-4">
                <p className="text-2xl font-bold">{fleet.counts.rented}</p>
                <p className="text-xs text-foreground/60">Alquilados</p>
              </div>
              <div className="rounded-xl border border-foreground/10 p-4">
                <p className="text-2xl font-bold">{fleet.counts.outOfService}</p>
                <p className="text-xs text-foreground/60">Fuera de servicio</p>
              </div>
            </div>
            {fleet.rented.length > 0 && (
              <div className="mt-2 divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
                {fleet.rented.map((r) => (
                  <Link
                    key={r.id}
                    href={r.vehicle ? `/vehicles/${r.vehicle.id}` : `/rentals/${r.id}`}
                    className={`flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-foreground/[0.03] ${paymentBorderClass(paymentAccent(r.status, r.bookingConfirmed, computeRentalPayments(r)))}`}
                  >
                    <span className="font-medium">
                      {r.vehicle ? vehicleLabelWithPlate(r.vehicle) : "—"}
                    </span>
                    <span className="text-right text-foreground/60">
                      {r.clientName} · vuelve {formatDateTime(r.endAt)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </Section>
    </div>
  );
}
