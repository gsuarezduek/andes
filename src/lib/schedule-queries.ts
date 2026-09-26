import "server-only";
import { prisma } from "@/lib/prisma";
import { formatDateInput, formatTime } from "@/lib/datetime";
import { dateToKey, keyToDate } from "@/lib/rooms/dates";
import { addDaysToKey } from "@/lib/rooms/ical";
import { WEEKDAY_LABELS, toMinutes, weekKeys, type Shift } from "@/lib/schedule";

export type WeekDay = { key: string; weekday: string; day: number; isToday: boolean };

export type WeekSchedule = {
  weekStart: string;
  days: WeekDay[];
  /** Personas con horario (activas), con su turno por día (null = no trabaja). */
  people: { id: string; name: string; shifts: Record<string, Shift | null> }[];
  todayKey: string;
  /** Minutos desde medianoche, hora de Mendoza — para saber qué turno está en curso. */
  nowMin: number;
};

/** Semana de lunes a domingo con el turno de cada persona que tiene horario. */
export async function getWeekSchedule(weekStart: string): Promise<WeekSchedule> {
  const keys = weekKeys(weekStart);
  const now = new Date();
  const todayKey = formatDateInput(now);
  const users = await prisma.user.findMany({
    where: { hasSchedule: true, active: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      shiftAssignments: {
        where: { date: { gte: keyToDate(keys[0]), lte: keyToDate(keys[6]) } },
        select: { date: true, shift: true },
      },
    },
  });
  return {
    weekStart,
    days: keys.map((key, i) => ({ key, weekday: WEEKDAY_LABELS[i], day: Number(key.slice(8, 10)), isToday: key === todayKey })),
    people: users.map((u) => {
      const shifts: Record<string, Shift | null> = Object.fromEntries(keys.map((k) => [k, null]));
      for (const a of u.shiftAssignments) shifts[dateToKey(a.date)] = a.shift;
      return { id: u.id, name: u.name, shifts };
    }),
    todayKey,
    nowMin: toMinutes(formatTime(now)),
  };
}

/** Semana anterior de las mismas personas, mapeada a los días de `weekStart` (para "copiar semana anterior"). */
export async function getPreviousWeekAsCurrent(weekStart: string, userIds: string[]): Promise<Record<string, Shift>> {
  const prevStart = addDaysToKey(weekStart, -7);
  const rows = await prisma.shiftAssignment.findMany({
    where: { userId: { in: userIds }, date: { gte: keyToDate(prevStart), lte: keyToDate(addDaysToKey(prevStart, 6)) } },
    select: { userId: true, date: true, shift: true },
  });
  const out: Record<string, Shift> = {};
  for (const r of rows) out[`${r.userId}|${addDaysToKey(dateToKey(r.date), 7)}`] = r.shift;
  return out;
}

export type ScheduleChangeView = {
  id: string;
  userName: string;
  date: string;
  from: Shift | null;
  to: Shift | null;
  changedByName: string;
  createdAt: Date;
};

export async function getScheduleChanges(limit = 40): Promise<ScheduleChangeView[]> {
  const rows = await prisma.shiftChange.findMany({ orderBy: { createdAt: "desc" }, take: limit });
  return rows.map((r) => ({
    id: r.id,
    userName: r.userName,
    date: dateToKey(r.date),
    from: r.fromShift,
    to: r.toShift,
    changedByName: r.changedByName,
    createdAt: r.createdAt,
  }));
}
