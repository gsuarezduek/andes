"use client";

import { TextField } from "@/components/ui/fields";

/**
 * "Tarea con agenda" (va abajo de "Fecha" en el alta y la edición de tareas):
 * tildado, pide la hora y la tarea aparece en la Agenda del Home ese día. El
 * estado vive en el form padre, que además usa `checked` para volver
 * obligatoria la fecha.
 */
export function ScheduledTimeField({
  checked,
  onCheckedChange,
  defaultTime,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  defaultTime?: string | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="scheduled"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
          className="h-4 w-4"
        />
        Tarea con agenda
        <span className="text-xs text-foreground/50">(aparece en la Agenda del Home)</span>
      </label>
      {checked && (
        <TextField
          id="scheduledTime"
          label="Hora"
          type="time"
          required
          defaultValue={defaultTime ?? ""}
          className="max-w-40"
        />
      )}
    </div>
  );
}
