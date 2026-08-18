import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";
import { getDashboardData, type MovementState } from "@/lib/dashboard";
import { getRentalPickerOptions } from "@/lib/cash";
import { getHomeTasks, isTaskOverdue, isTaskDueToday } from "@/lib/tasks";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { HomeSearch } from "@/components/home-search";
import { formatDateTime, formatDate } from "@/lib/datetime";
import { paymentBorderClass } from "@/lib/rental-ui";
import { computeRentalPayments, paymentAccent, type PaymentAccent } from "@/lib/rental-payments";

const stateTone: Record<MovementState, "amber" | "emerald" | "red"> = {
  pendiente: "amber",
  completada: "emerald",
  demorada: "red",
};

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

function MovementRow({
  href,
  title,
  subtitle,
  time,
  state,
  unconfirmed,
  accent,
}: {
  href: string;
  title: string;
  subtitle: string;
  time: string;
  state: MovementState;
  unconfirmed?: boolean;
  accent?: PaymentAccent;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-foreground/[0.03] ${paymentBorderClass(accent ?? null)}`}
    >
      <div className="flex-1">
        <p className="flex items-center gap-2 font-medium">
          {title}
          {unconfirmed ? <Badge tone="orange">Sin confirmar</Badge> : null}
        </p>
        <p className="text-sm text-foreground/60">{subtitle}</p>
        <p className="text-xs text-foreground/50">{time}</p>
      </div>
      <Badge tone={stateTone[state]}>{state}</Badge>
    </Link>
  );
}

export default async function HomePage() {
  const user = await requireUser();
  const [{ today, fleet, alerts }, rentalOptions, tasks] = await Promise.all([
    getDashboardData(),
    getRentalPickerOptions(),
    getHomeTasks(user.id),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Hola, {user.name?.split(" ")[0] ?? "equipo"}</h1>
        <p className="text-sm text-foreground/60">Movimientos de hoy y estado de la flota.</p>
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

      {/* ALERTAS: arriba de todo — es lo que más necesita atención al entrar. */}
      <Section title="Alertas">
        {alerts.overdueReturns.length === 0 &&
        alerts.upcomingServices.length === 0 &&
        alerts.unassigned.length === 0 ? (
          <Empty>Sin alertas. Todo al día.</Empty>
        ) : (
          <div className="flex flex-col gap-3">
            {alerts.overdueReturns.map((r) => (
              <Link key={r.id} href={`/rentals/${r.id}`} className="flex items-center justify-between rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm">
                <span className="font-medium text-red-700 dark:text-red-400">Devolución vencida</span>
                <span className="text-right text-foreground/70">
                  {r.clientName}{r.vehicle ? ` · ${r.vehicle.plate}` : ""} · venció {formatDateTime(r.endAt)}
                </span>
              </Link>
            ))}
            {alerts.upcomingServices.map((v) => (
              <Link
                key={v.id}
                href={`/vehicles/${v.id}`}
                className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm ${v.critical ? "border-red-500/30 bg-red-500/5" : "border-amber-500/30 bg-amber-500/5"}`}
              >
                <span className={`font-medium ${v.critical ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}`}>
                  {v.overdue ? "Service vencido" : "Service próximo"}
                </span>
                <span className="text-right text-foreground/70">
                  {v.brand} {v.model} · {v.currentKm.toLocaleString("es-AR")} / {v.nextServiceKm?.toLocaleString("es-AR")} km
                </span>
              </Link>
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
        )}
      </Section>

      {/* HOY */}
      <div className="grid gap-6 md:grid-cols-2">
        <Section title={`Entregas de hoy (${today.handovers.length})`}>
          {today.handovers.length === 0 ? (
            <Empty>No hay entregas programadas para hoy.</Empty>
          ) : (
            <div className="divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
              {today.handovers.map(({ rental, state }) => (
                <MovementRow
                  key={rental.id}
                  href={`/rentals/${rental.id}`}
                  title={rental.clientName}
                  subtitle={rental.vehicle ? `${rental.vehicle.brand} ${rental.vehicle.model} · ${rental.vehicle.plate}` : "Sin vehículo asignado"}
                  time={`Retiro ${formatDateTime(rental.startAt)}`}
                  state={state}
                  unconfirmed={!rental.bookingConfirmed}
                  accent={paymentAccent(rental.status, rental.bookingConfirmed, computeRentalPayments(rental))}
                />
              ))}
            </div>
          )}
        </Section>

        <Section title={`Devoluciones de hoy (${today.returns.length})`}>
          {today.returns.length === 0 ? (
            <Empty>No hay devoluciones programadas para hoy.</Empty>
          ) : (
            <div className="divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
              {today.returns.map(({ rental, state }) => (
                <MovementRow
                  key={rental.id}
                  href={`/rentals/${rental.id}`}
                  title={rental.clientName}
                  subtitle={rental.vehicle ? `${rental.vehicle.brand} ${rental.vehicle.model} · ${rental.vehicle.plate}` : "Sin vehículo"}
                  time={`Devolución ${formatDateTime(rental.endAt)}`}
                  state={state}
                  unconfirmed={!rental.bookingConfirmed}
                  accent={paymentAccent(rental.status, rental.bookingConfirmed, computeRentalPayments(rental))}
                />
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* TAREAS: mis pendientes + las de cualquiera que vencen hoy o ya vencieron. */}
      <Section title={`Tareas (${tasks.length})`}>
        {tasks.length === 0 ? (
          <Empty>No hay tareas pendientes para hoy.</Empty>
        ) : (
          <div className="divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
            {tasks.map((task) => {
              const overdue = isTaskOverdue(task);
              const dueToday = isTaskDueToday(task);
              return (
                <Link
                  key={task.id}
                  href="/tasks"
                  className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-foreground/[0.03] ${
                    overdue ? "border-l-4 border-l-red-500" : dueToday ? "border-l-4 border-l-amber-500" : "border-l-4 border-l-transparent"
                  }`}
                >
                  <div className="flex-1">
                    <p className="flex items-center gap-2 font-medium">
                      {task.text}
                      {task.priority === "high" ? <Badge tone="red">Alta</Badge> : null}
                    </p>
                    <p className="text-sm text-foreground/60">
                      {task.assignedTo ? task.assignedTo.name : "Sin asignar"}
                      {task.vehicle ? ` · ${task.vehicle.brand} ${task.vehicle.model} · ${task.vehicle.plate}` : ""}
                    </p>
                  </div>
                  {task.dueDate ? (
                    <Badge tone={overdue ? "red" : dueToday ? "amber" : "neutral"}>{formatDate(task.dueDate)}</Badge>
                  ) : null}
                </Link>
              );
            })}
          </div>
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
                      {r.vehicle ? `${r.vehicle.brand} ${r.vehicle.model} · ${r.vehicle.plate}` : "—"}
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
