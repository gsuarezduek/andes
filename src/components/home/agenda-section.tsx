import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ChevronRightIcon } from "@/components/ui/icons";
import { paymentBorderClass } from "@/lib/rental-ui";
import {
  agendaTitle,
  nowMarkerIndex,
  type AgendaItem,
  type AgendaRentalItem,
  type AgendaRoomItem,
  type AgendaState,
  type AgendaTaskItem,
} from "@/lib/agenda";
import type { AgendaData } from "@/lib/agenda-queries";
import { addDaysToKey } from "@/lib/rooms/ical";
import { AgendaTaskDone } from "@/components/home/agenda-task-done";

const stateTone: Record<AgendaState, "amber" | "emerald" | "red"> = {
  pendiente: "amber",
  completada: "emerald",
  demorada: "red",
};

const KIND_LABEL: Record<AgendaItem["kind"], string> = {
  handover: "Entrega",
  return: "Devolución",
  task: "Tarea",
  checkin: "Check-in",
  checkout: "Check-out",
};

const KIND_COLOR: Record<AgendaItem["kind"], string> = {
  handover: "text-blue-600 dark:text-blue-400",
  return: "text-violet-600 dark:text-violet-400",
  task: "text-foreground/60",
  checkin: "text-teal-600 dark:text-teal-400",
  checkout: "text-teal-600 dark:text-teal-400",
};

function KindLabel({ item }: { item: AgendaItem }) {
  return (
    <span className={`text-[11px] font-semibold uppercase tracking-wide ${KIND_COLOR[item.kind]}`}>
      {KIND_LABEL[item.kind]}
    </span>
  );
}

function PlaceTag({ place }: { place: AgendaRentalItem["place"] }) {
  if (!place) return null;
  return (
    <span className="rounded bg-foreground/10 px-1.5 py-px font-mono text-[10px] font-semibold text-foreground/70">
      {place}
    </span>
  );
}

function Time({ time }: { time: string }) {
  return <span className="w-12 shrink-0 pt-0.5 font-mono text-sm font-semibold tabular-nums">{time}</span>;
}

function RentalRow({ item, compact }: { item: AgendaRentalItem; compact?: boolean }) {
  return (
    <li>
      <Link
        href={`/rentals/${item.rentalId}`}
        className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-foreground/[0.03] ${paymentBorderClass(item.accent)}`}
      >
        <Time time={item.time} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5">
            <KindLabel item={item} />
            {/* En la columna de oficina el lugar es siempre OFI y el estado va
                acá mismo: la columna es angosta y no entra a la derecha. */}
            {compact ? <Badge tone={stateTone[item.state]}>{item.state}</Badge> : <PlaceTag place={item.place} />}
            {item.unconfirmed ? <Badge tone="orange">Sin confirmar</Badge> : null}
          </p>
          <p className="truncate font-medium">{item.clientName}</p>
          <p className="truncate text-sm text-foreground/60">{item.vehicleLabel ?? "Sin vehículo asignado"}</p>
        </div>
        {compact ? null : <Badge tone={stateTone[item.state]}>{item.state}</Badge>}
      </Link>
    </li>
  );
}

function RoomRow({ item }: { item: AgendaRoomItem }) {
  return (
    <li>
      <Link
        href={`/rooms/${item.roomId}/bookings/${item.bookingId}`}
        className="flex items-start gap-3 border-l-4 border-l-transparent px-4 py-3 transition-colors hover:bg-foreground/[0.03]"
      >
        <Time time={item.time} />
        <div className="min-w-0 flex-1">
          <KindLabel item={item} />
          <p className="truncate font-medium">{item.guest}</p>
          <p className="truncate text-sm text-foreground/60">
            {item.roomName} · {item.sourceLabel}
          </p>
        </div>
      </Link>
    </li>
  );
}

function TaskRow({ item }: { item: AgendaTaskItem }) {
  const done = item.state === "completada";
  return (
    <li className="flex items-start gap-3 border-l-4 border-l-transparent px-4 py-3">
      <Time time={item.time} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1.5">
          <KindLabel item={item} />
          {item.highPriority && !done ? <Badge tone="red">Alta</Badge> : null}
        </p>
        {done ? (
          <p className="font-medium text-foreground/50 line-through">{item.text}</p>
        ) : (
          <Link href={`/tasks#task-${item.taskId}`} className="font-medium hover:opacity-70">
            {item.text}
          </Link>
        )}
        <p className="text-sm text-foreground/60">
          {item.assignedToName ?? "Sin asignar"}
          {item.vehicleId ? (
            <>
              {" · "}
              <Link href={`/vehicles/${item.vehicleId}`} className="underline">
                {item.vehicleLabel}
              </Link>
            </>
          ) : null}
          {item.rentalId ? (
            <>
              {" · "}
              <Link href={`/rentals/${item.rentalId}`} className="underline">
                {item.rentalClientName}
              </Link>
            </>
          ) : null}
          {done && item.completedByName ? ` · hecha por ${item.completedByName}` : null}
        </p>
      </div>
      {done ? (
        <Badge tone="emerald">hecha</Badge>
      ) : (
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {item.state === "demorada" ? <Badge tone="red">demorada</Badge> : null}
          <AgendaTaskDone taskId={item.taskId} />
        </div>
      )}
    </li>
  );
}

function AgendaRow({ item, compact }: { item: AgendaItem; compact?: boolean }) {
  if (item.kind === "task") return <TaskRow item={item} />;
  if ("rentalId" in item) return <RentalRow item={item} compact={compact} />;
  return <RoomRow item={item} />;
}

function NowMarker({ time }: { time: string }) {
  return (
    <li aria-label={`Ahora, ${time}`} className="flex items-center gap-2 border-l-4 border-l-transparent px-4 py-1">
      <span className="font-mono text-[11px] font-semibold text-red-600 dark:text-red-400">{time}</span>
      <span className="h-0.5 flex-1 rounded-full bg-red-500" />
      <span className="text-[11px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">Ahora</span>
    </li>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-foreground/10 px-4 py-3 text-sm text-foreground/50">{children}</p>
  );
}

const navClass =
  "rounded-md p-1 text-foreground/50 transition-colors hover:bg-foreground/5 hover:text-foreground";

/**
 * Agenda del día en el Home: 3/4 para lo que tiene horario y obliga a alguien
 * a estar (entregas, devoluciones fuera de la oficina, tareas con agenda,
 * check-in), 1/4 para lo que pasa en la oficina sin salir (devoluciones en
 * oficina, check-out). En el celular se apila, la agenda principal primero.
 * `dayHref` arma el link a otro día conservando el resto de la URL del Home.
 */
export function AgendaSection({
  agenda,
  dayKey,
  todayKey,
  nowTime,
  dayHref,
}: {
  agenda: AgendaData;
  dayKey: string;
  todayKey: string;
  /** "HH:MM" de ahora en Mendoza — solo se usa si `dayKey` es hoy. */
  nowTime: string;
  dayHref: (day: string) => string;
}) {
  const isToday = dayKey === todayKey;
  const markerAt = isToday ? nowMarkerIndex(agenda.timeline, nowTime) : -1;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
          {agendaTitle(dayKey, todayKey)}
        </h2>
        <div className="flex items-center gap-0.5">
          <Link href={dayHref(addDaysToKey(dayKey, -1))} scroll={false} aria-label="Día anterior" className={navClass}>
            <ChevronRightIcon className="size-4 rotate-180" />
          </Link>
          {!isToday ? (
            <Link href={dayHref(todayKey)} scroll={false} className="px-1 text-[11px] font-medium text-foreground/50 underline">
              Hoy
            </Link>
          ) : null}
          <Link href={dayHref(addDaysToKey(dayKey, 1))} scroll={false} aria-label="Día siguiente" className={navClass}>
            <ChevronRightIcon className="size-4" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="flex min-w-0 flex-col gap-2 md:col-span-3">
          <p className="text-xs text-foreground/50">Por horario ({agenda.timeline.length})</p>
          {agenda.timeline.length === 0 ? (
            <Empty>No hay nada agendado.</Empty>
          ) : (
            <ul className="divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
              {agenda.timeline.map((item, i) => (
                <AgendaFragment key={item.key} item={item} marker={i === markerAt ? nowTime : null} />
              ))}
              {markerAt === agenda.timeline.length ? <NowMarker time={nowTime} /> : null}
            </ul>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-xs text-foreground/50">En la oficina ({agenda.office.length})</p>
          {agenda.office.length === 0 ? (
            <Empty>Sin devoluciones en la oficina.</Empty>
          ) : (
            <ul className="divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
              {agenda.office.map((item) => (
                <AgendaRow key={item.key} item={item} compact />
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function AgendaFragment({ item, marker }: { item: AgendaItem; marker: string | null }) {
  return (
    <>
      {marker ? <NowMarker time={marker} /> : null}
      <AgendaRow item={item} />
    </>
  );
}
