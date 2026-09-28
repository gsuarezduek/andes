import {
  SCHEDULE_ROWS,
  SHIFT_SEGMENTS,
  chipStatus,
  rowLabels,
  segmentRange,
  shortNames,
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

type Entry = { personId: string; name: string; seg: Segment; shift: Shift };

/**
 * Semana de lunes a domingo dividida en Mañana / Tarde. Cada persona es un chip: verde = en turno ahora mismo,
 * azul = activo en otro horario (hoy fuera de su franja, otro día, o guardia). Un cortado y una guardia aparecen
 * en las dos filas (el cortado con las horas de cada parte). `currentUserId` resalta al usuario que está mirando.
 */
export function WeekScheduleGrid({ schedule, currentUserId }: { schedule: WeekSchedule; currentUserId?: string }) {
  const names = shortNames(schedule.people);
  const entriesFor = (row: ScheduleRow, dayKey: string): Entry[] =>
    schedule.people.flatMap((p) => {
      const shift = p.shifts[dayKey];
      if (!shift) return [];
      return SHIFT_SEGMENTS[shift]
        .filter((seg) => seg.row === row)
        .map((seg) => ({ personId: p.id, name: names.get(p.id) ?? p.name, seg, shift }));
    });

  return (
    <ScrollToToday className="overflow-x-auto rounded-xl border border-foreground/10">
      <table className="w-full min-w-[620px] table-fixed border-collapse text-sm">
        <thead>
          <tr className="border-b border-foreground/10">
            <th className="sticky left-0 z-10 w-20 bg-background px-2 py-2" />
            {schedule.days.map((d) => (
              <th
                key={d.key}
                data-today={d.isToday ? "" : undefined}
                className={`px-1 py-2 text-center font-normal ${d.isToday ? "bg-blue-500/15" : ""}`}
              >
                <div className={`text-[10px] uppercase ${d.isToday ? "font-bold text-blue-600" : "text-foreground/40"}`}>{d.weekday}</div>
                <div className={`text-base tabular-nums ${d.isToday ? "font-bold text-blue-600" : "text-foreground/70"}`}>{d.day}</div>
              </th>
            ))}
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
                return (
                  <td key={d.key} className={`align-top px-1 py-1.5 ${d.isToday ? "bg-blue-500/[0.07]" : ""}`}>
                    <div className="flex flex-col items-stretch gap-1">
                      {entries.map((e) => {
                        const status = chipStatus(e.seg, d.isToday, schedule.nowMin);
                        const isMe = e.personId === currentUserId;
                        return (
                          <span
                            key={`${e.personId}-${e.seg.start}`}
                            title={`${e.name} · ${shiftLabels[e.shift]}${e.seg.onCall ? "" : ` ${segmentRange(e.seg)}`}`}
                            className={`truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium ${chipClasses[status]} ${
                              isMe ? "ring-2 ring-offset-1 ring-offset-background ring-violet-500 dark:ring-violet-400" : ""
                            }`}
                          >
                            {e.name}
                            {e.shift === "split" ? ` · ${segmentRange(e.seg)}` : ""}
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
