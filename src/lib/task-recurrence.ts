/**
 * Cálculo puro de fechas para tareas recurrentes (Task.recurrenceId /
 * TaskRecurrence). No toca Prisma — server actions y componentes de
 * cliente pueden importar esto por igual.
 *
 * La regla no guarda "día fijo" como algo que el empleado elige aparte: se
 * deriva siempre de la fecha ya cargada en "Fecha" (`ruleFromDueDate`). Así
 * "mensual, día fijo" es literalmente el día del mes de esa fecha, sin un
 * selector redundante.
 */
import type { RecurrenceFreq } from "@prisma/client";
import { formatDateInput, mendozaWallTimeToUtc } from "@/lib/datetime";

export type RecurrenceRule = {
  freq: RecurrenceFreq;
  interval: number;
  weekday: number | null; // 0=domingo..6=sábado; solo weekly
  dayOfMonth: number | null; // 1-31; solo monthly/yearly
  month: number | null; // 1-12; solo yearly
};

/** Cantidad de días de un mes (`month` 1-12). */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Deriva la regla (weekday/dayOfMonth/month) a partir de la fecha elegida. */
export function ruleFromDueDate(
  freq: Exclude<RecurrenceFreq, never>,
  interval: number,
  dueDate: Date,
): RecurrenceRule {
  const [yStr, mStr, dStr] = formatDateInput(dueDate).split("-");
  const year = Number(yStr);
  const month = Number(mStr);
  const day = Number(dStr);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return {
    freq,
    interval,
    weekday: freq === "weekly" ? weekday : null,
    dayOfMonth: freq === "monthly" || freq === "yearly" ? day : null,
    month: freq === "yearly" ? month : null,
  };
}

/**
 * Próxima fecha (medianoche Mendoza) según la regla, a partir de la fecha de
 * la ocurrencia que se completó/borró. Para monthly/yearly conserva el
 * `dayOfMonth`/`month` de la regla, recortando al último día del mes cuando
 * no existe (ej. 31 en abril → 30, 29/2 en año no bisiesto → 28/2).
 */
export function computeNextDueDate(rule: RecurrenceRule, fromDate: Date): Date {
  const [yStr, mStr, dStr] = formatDateInput(fromDate).split("-");
  let year = Number(yStr);
  let month = Number(mStr);
  let day = Number(dStr);

  if (rule.freq === "daily") {
    const next = new Date(Date.UTC(year, month - 1, day + rule.interval));
    year = next.getUTCFullYear();
    month = next.getUTCMonth() + 1;
    day = next.getUTCDate();
  } else if (rule.freq === "weekly") {
    const next = new Date(Date.UTC(year, month - 1, day + rule.interval * 7));
    year = next.getUTCFullYear();
    month = next.getUTCMonth() + 1;
    day = next.getUTCDate();
  } else if (rule.freq === "monthly") {
    const targetDay = rule.dayOfMonth ?? day;
    const m = month + rule.interval;
    year += Math.floor((m - 1) / 12);
    month = ((m - 1) % 12) + 1;
    day = Math.min(targetDay, daysInMonth(year, month));
  } else {
    const targetMonth = rule.month ?? month;
    const targetDay = rule.dayOfMonth ?? day;
    year += rule.interval;
    month = targetMonth;
    day = Math.min(targetDay, daysInMonth(year, month));
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  return mendozaWallTimeToUtc(`${year}-${pad(month)}-${pad(day)}T00:00`);
}

const WEEKDAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** Etiqueta en español para el badge de una tarea recurrente. */
export function describeRecurrence(rule: RecurrenceRule): string {
  const n = rule.interval;
  if (rule.freq === "daily") {
    return n === 1 ? "Se repite todos los días" : `Se repite cada ${n} días`;
  }
  if (rule.freq === "weekly") {
    const day = rule.weekday != null ? ` los ${WEEKDAY_NAMES[rule.weekday]}` : "";
    return n === 1 ? `Se repite cada semana${day}` : `Se repite cada ${n} semanas${day}`;
  }
  if (rule.freq === "monthly") {
    const day = rule.dayOfMonth != null ? ` el día ${rule.dayOfMonth}` : "";
    return n === 1 ? `Se repite cada mes${day}` : `Se repite cada ${n} meses${day}`;
  }
  const when =
    rule.dayOfMonth != null && rule.month != null ? ` el ${rule.dayOfMonth} de ${MONTH_NAMES[rule.month - 1]}` : "";
  return n === 1 ? `Se repite cada año${when}` : `Se repite cada ${n} años${when}`;
}
