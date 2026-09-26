"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/fields";
import { SHIFTS, shiftLabels, type Shift } from "@/lib/schedule";
import type { WeekDay } from "@/lib/schedule-queries";
import { saveWeekSchedule } from "@/app/(app)/horarios/actions";

type Values = Record<string, Shift | "">;
const cellKey = (userId: string, day: string) => `${userId}|${day}`;

const cellTint: Record<Shift | "", string> = {
  "": "",
  morning: "bg-foreground/[0.06]",
  afternoon: "bg-foreground/[0.06]",
  split: "bg-amber-500/15",
  on_call: "bg-blue-500/20",
};

/**
 * Editor de la semana (admin): una grilla personas × días con un selector por
 * celda. Solo se envían las celdas que cambiaron. "Copiar semana anterior"
 * completa las celdas vacías con lo de la semana pasada (sin pisar lo ya
 * cargado) y se revisa antes de guardar.
 */
export function WeekEditor({
  weekStart,
  days,
  people,
  initial,
  previous,
}: {
  weekStart: string;
  days: WeekDay[];
  people: { id: string; name: string }[];
  initial: Values;
  previous: Record<string, Shift>;
}) {
  const [values, setValues] = useState<Values>(initial);
  // Si los datos del server cambian (guardé yo, o lo tocó otro admin), las celdas
  // sin cambios míos se actualizan y las que estoy editando se conservan. Ajuste
  // de estado durante el render (patrón recomendado en vez de un efecto).
  const initialJson = JSON.stringify(initial);
  const [seen, setSeen] = useState({ json: initialJson, initial });
  if (seen.json !== initialJson) {
    setSeen({ json: initialJson, initial });
    setValues((cur) => {
      const next: Values = {};
      for (const k of new Set([...Object.keys(cur), ...Object.keys(initial)])) {
        next[k] = (cur[k] ?? "") === (seen.initial[k] ?? "") ? (initial[k] ?? "") : (cur[k] ?? "");
      }
      return next;
    });
  }
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const changedKeys = Object.keys(values).filter((k) => (values[k] ?? "") !== (initial[k] ?? ""));
  const copyable = Object.keys(previous).filter((k) => !(values[k] ?? "")).length;

  function set(key: string, v: Shift | "") {
    setSaved(null);
    setValues((cur) => ({ ...cur, [key]: v }));
  }

  function copyPrevious() {
    setSaved(null);
    setValues((cur) => {
      const next = { ...cur };
      for (const [k, shift] of Object.entries(previous)) if (!next[k]) next[k] = shift;
      return next;
    });
  }

  function save() {
    setError(null);
    setSaved(null);
    const changes = changedKeys.map((k) => {
      const [userId, date] = k.split("|");
      return { userId, date, shift: (values[k] || null) as Shift | null };
    });
    startTransition(async () => {
      const res = await saveWeekSchedule({ weekStart, changes });
      if (res.ok) setSaved(`Guardado (${res.changed} cambio${res.changed === 1 ? "" : "s"}).`);
      else setError(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-xl border border-foreground/10">
        <table className="w-full min-w-[720px] table-fixed border-collapse text-sm">
          <thead>
            <tr className="border-b border-foreground/10">
              <th className="sticky left-0 z-10 w-28 bg-background px-2 py-2 text-left text-xs font-semibold text-foreground/50">Persona</th>
              {days.map((d) => (
                <th key={d.key} className={`px-1 py-2 text-center font-normal ${d.isToday ? "bg-blue-500/15" : ""}`}>
                  <div className="text-[10px] uppercase text-foreground/40">{d.weekday}</div>
                  <div className="text-base tabular-nums text-foreground/70">{d.day}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id} className="border-b border-foreground/5 last:border-0">
                <th className="sticky left-0 z-10 truncate bg-background px-2 py-1.5 text-left text-sm font-medium">{p.name}</th>
                {days.map((d) => {
                  const k = cellKey(p.id, d.key);
                  const v = values[k] ?? "";
                  const dirty = v !== (initial[k] ?? "");
                  return (
                    <td key={d.key} className="px-1 py-1">
                      <select
                        aria-label={`${p.name}, ${d.weekday} ${d.day}`}
                        value={v}
                        onChange={(e) => set(k, e.target.value as Shift | "")}
                        className={`h-9 w-full rounded-md border bg-transparent px-1 text-xs outline-none focus:border-foreground/40 ${cellTint[v]} ${
                          dirty ? "border-amber-500" : "border-foreground/15"
                        }`}
                      >
                        <option value="">Libre</option>
                        {SHIFTS.map((s) => (
                          <option key={s} value={s}>
                            {shiftLabels[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <FormError>{error}</FormError>
      {saved ? <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">{saved}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={save} disabled={pending || changedKeys.length === 0}>
          {pending ? "Guardando…" : changedKeys.length > 0 ? `Guardar ${changedKeys.length} cambio${changedKeys.length === 1 ? "" : "s"}` : "Guardar"}
        </Button>
        <Button type="button" variant="secondary" onClick={copyPrevious} disabled={pending || copyable === 0}>
          Copiar semana anterior{copyable > 0 ? ` (${copyable})` : ""}
        </Button>
        {changedKeys.length > 0 ? (
          <button type="button" onClick={() => setValues(initial)} className="text-xs text-foreground/50 underline">
            Descartar
          </button>
        ) : null}
      </div>
      <p className="text-xs text-foreground/50">
        Las celdas con borde ámbar tienen cambios sin guardar. «Copiar semana anterior» solo completa los días que están libres.
      </p>
    </div>
  );
}
