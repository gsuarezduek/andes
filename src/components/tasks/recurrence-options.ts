/** Opciones compartidas entre el alta (TaskForm) y la edición (TaskRow) de "Repetir". */
export const RECURRENCE_OPTIONS = [
  { value: "none", label: "Sin repetición" },
  { value: "daily", label: "Diaria" },
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensual" },
  { value: "yearly", label: "Anual" },
] as const;

export type RecurrenceFormFreq = (typeof RECURRENCE_OPTIONS)[number]["value"];

/** Unidad para el campo "Cada N ___" según la frecuencia elegida. */
export function RECURRENCE_INTERVAL_UNIT(freq: RecurrenceFormFreq): string {
  switch (freq) {
    case "daily":
      return "días";
    case "weekly":
      return "semanas";
    case "monthly":
      return "meses";
    case "yearly":
      return "años";
    default:
      return "";
  }
}
