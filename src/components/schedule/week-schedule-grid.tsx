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
  inactive: "bg-red-500/90 text-white",
  on_call: "bg-blue-600 text-white",
  scheduled: "bg-foreground/10 text-foreground",
};

/** Horario de cada fila, para el rótulo ("Mañana 9–16"). Guardia no tiene rango. */
const rowRange: Record<ScheduleRow, string | null> = {
  morning: segmentRange(SHIFT_SEGMENTS.morning[0]),
  afternoon: segmentRange(SHIFT_SEGMENTS.afternoon[0]),
  on_call: null,
};

type Entry = { personId: string; name: string; seg: Segment; shift: Shift };

/**
 * Semana de lunes a domingo dividida en Mañana / Tarde (y Guardia, si alguien la
 * tiene esa semana). Cada persona es un chip: verde = en turno ahora, rojo =
 * hoy pero fuera de su horario, azul = guardia, gris = otros días. Un cortado
 * aparece en las dos filas, con las horas de cada parte.
 */
export function WeekScheduleGrid({ schedule }: { schedule: WeekSchedule }) {
  const names = shortNames(schedule.people);
  const entriesFor = (row: ScheduleRow, dayKey: string): Entry[] =>
    schedule.people.flatMap((p) => {
      const shift = p.shifts[dayKey];
      if (!shift) return [];
      return SHIFT_SEGMENTS[shift]
        .filter((seg) => seg.row === row)
        .map((seg) => ({ personId: p.id, name: names.get(p.id) ?? p.name, seg, shift }));
    });

  const hasOnCall = schedule.people.some((p) => Object.values(p.shifts).includes("on_call"));
  const rows = SCHEDULE_ROWS.filter((r) => r !== "on_call" || hasOnCall);

  return (
    <div className="flex flex-col gap-2">
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
            {rows.map((row) => (
              <tr key={row} className="border-b border-foreground/5 last:border-0">
                <th className="sticky left-0 z-10 bg-background px-2 py-2 text-left align-top">
                  <div className="text-xs font-semibold">{rowLabels[row]}</div>
                  {rowRange[row] ? <div className="text-[10px] font-normal text-foreground/50">{rowRange[row]}</div> : null}
                </th>
                {schedule.days.map((d) => {
                  const entries = entriesFor(row, d.key);
                  return (
                    <td key={d.key} className={`align-top px-1 py-1.5 ${d.isToday ? "bg-blue-500/[0.07]" : ""}`}>
                      <div className="flex flex-col items-stretch gap-1">
                        {entries.map((e) => {
                          const status = chipStatus(e.seg, d.isToday, schedule.nowMin);
                          return (
                            <span
                              key={`${e.personId}-${e.seg.start}`}
                              title={`${e.name} · ${shiftLabels[e.shift]}${row === "on_call" ? "" : ` ${segmentRange(e.seg)}`}`}
                              className={`truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium ${chipClasses[status]}`}
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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-foreground/60">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded bg-emerald-500" /> En turno ahora
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded bg-red-500/90" /> Hoy, fuera de horario
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded bg-blue-600" /> Guardia
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded bg-foreground/15" /> Otros días
        </span>
      </div>
    </div>
  );
}
