import {
  SCHEDULE_ROWS,
  SHIFT_SEGMENTS,
  chipStatusMulti,
  isWeekendKey,
  rangeLabel,
  rowLabels,
  segmentRange,
  shortNames,
  spansFullDay,
  shiftLabels,
  type ChipStatus,
  type ScheduleRow,
  type Segment,
  type Shift,
} from "@/lib/schedule";
import type { WeekSchedule } from "@/lib/schedule-queries";
import { ScrollToToday } from "./scroll-to-today";

const chipClasses: Record<ChipStatus, string> = {
  active: "bg-emerald-500 text-white",
  other: "bg-blue-600 text-white",
};

/** Horario de cada fila, para el rótulo ("Mañana 9–16"). */
const rowRange: Record<ScheduleRow, string> = {
  morning: segmentRange(SHIFT_SEGMENTS.morning[0]),
  afternoon: segmentRange(SHIFT_SEGMENTS.afternoon[0]),
};

type Entry = { personId: string; name: string; segs: Segment[]; shift: Shift };

/**
 * Semana de lunes a domingo dividida en Mañana / Tarde. Cada persona es un chip: verde = en turno ahora mismo,
 * azul = activo en otro horario (hoy fuera de su franja, otro día, o guardia). Un turno de día completo (cortado
 * o guardia) se unifica en un solo chip, en la fila de Mañana, en vez de repetirse en las dos filas. Fin de
 * semana con fondo propio. `currentUserId` resalta al usuario que está mirando.
 */
export function WeekScheduleGrid({ schedule, currentUserId }: { schedule: WeekSchedule; currentUserId?: string }) {
  const names = shortNames(schedule.people);
  const entriesFor = (row: ScheduleRow, dayKey: string): Entry[] =>
    schedule.people.flatMap((p) => {
      const shift = p.shifts[dayKey];
      if (!shift) return [];
      const segs = SHIFT_SEGMENTS[shift];
      // Un turno de día completo se unifica en Mañana; el resto va en la fila que le corresponde.
      const belongsHere = spansFullDay(shift) ? row === "morning" : segs.some((seg) => seg.row === row);
      if (!belongsHere) return [];
      return [{ personId: p.id, name: names.get(p.id) ?? p.name, segs, shift }];
    });

  return (
    <ScrollToToday className="overflow-x-auto rounded-xl border border-foreground/10">
      <table className="w-full min-w-[620px] table-fixed border-collapse text-sm">
        <thead>
          <tr className="border-b border-foreground/10">
            <th className="sticky left-0 z-10 w-20 bg-background px-2 py-2" />
            {schedule.days.map((d) => {
              const weekend = isWeekendKey(d.key);
              return (
                <th
                  key={d.key}
                  data-today={d.isToday ? "" : undefined}
                  title={d.special ?? undefined}
                  className={`px-1 py-2 text-center font-normal ${d.isToday ? "bg-blue-500/15" : d.special ? "bg-yellow-400/25" : weekend ? "bg-amber-500/10" : ""}`}
                >
                  <div
                    className={`text-[10px] uppercase ${d.isToday ? "font-bold text-blue-600" : d.special ? "text-yellow-700 dark:text-yellow-400" : weekend ? "text-amber-700 dark:text-amber-500" : "text-foreground/40"}`}
                  >
                    {d.weekday}
                  </div>
                  <div
                    className={`text-base tabular-nums ${d.isToday ? "font-bold text-blue-600" : d.special ? "font-medium text-yellow-700 dark:text-yellow-400" : weekend ? "font-medium text-amber-700 dark:text-amber-500" : "text-foreground/70"}`}
                  >
                    {d.day}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {SCHEDULE_ROWS.map((row) => (
            <tr key={row} className="border-b border-foreground/5 last:border-0">
              <th className="sticky left-0 z-10 bg-background px-2 py-2 text-left align-top">
                <div className="text-xs font-semibold">{rowLabels[row]}</div>
                <div className="text-[10px] font-normal text-foreground/50">{rowRange[row]}</div>
              </th>
              {schedule.days.map((d) => {
                const entries = entriesFor(row, d.key);
                const weekend = isWeekendKey(d.key);
                return (
                  <td
                    key={d.key}
                    title={d.special ?? undefined}
                    className={`align-top px-1 py-1.5 ${d.isToday ? "bg-blue-500/[0.07]" : d.special ? "bg-yellow-400/10" : weekend ? "bg-amber-500/5" : ""}`}
                  >
                    <div className="flex flex-col items-stretch gap-1">
                      {entries.map((e) => {
                        const status = chipStatusMulti(e.segs, d.isToday, schedule.nowMin);
                        const isMe = e.personId === currentUserId;
                        const range = rangeLabel(e.segs);
                        return (
                          <span
                            key={e.personId}
                            title={`${e.name} · ${shiftLabels[e.shift]}${range ? ` ${range}` : ""}`}
                            className={`truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium ${chipClasses[status]} ${
                              isMe ? "ring-2 ring-offset-1 ring-offset-background ring-violet-500 dark:ring-violet-400" : ""
                            }`}
                          >
                            {e.name}
                            {e.shift === "split" ? ` · ${range}` : ""}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollToToday>
  );
}
