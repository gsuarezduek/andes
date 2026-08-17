import { formatDateInput } from "@/lib/datetime";

export type DayGroup<T> = {
  key: string; // "YYYY-MM-DD"
  label: string; // "Hoy" | "Día 13"
  rentals: T[];
};

export type MonthGroup<T> = {
  key: string; // "YYYY-MM"
  label: string; // "Agosto" | "Enero de 2027"
  isCurrentMonth: boolean;
  rentals: T[]; // todas las del mes, en orden
  /** Solo poblado cuando `isCurrentMonth` — el resto queda como lista plana. */
  days: DayGroup<T>[];
};

const MONTH_FORMATTER_SAME_YEAR = new Intl.DateTimeFormat("es-AR", {
  month: "long",
  timeZone: "America/Argentina/Mendoza",
});
const MONTH_FORMATTER_OTHER_YEAR = new Intl.DateTimeFormat("es-AR", {
  month: "long",
  year: "numeric",
  timeZone: "America/Argentina/Mendoza",
});

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Agrupa reservas "Próximas" (se asume orden de entrada por `startAt` asc,
 * como devuelven las queries) por mes calendario en hora de Mendoza. Solo el
 * mes actual se subdivide por día — el resto queda como lista plana por mes,
 * para no saturar la vista con reservas lejanas en el tiempo.
 */
export function groupUpcomingByMonth<T extends { startAt: Date }>(
  rentals: T[],
  now: Date,
): MonthGroup<T>[] {
  const currentMonthKey = formatDateInput(now).slice(0, 7);
  const todayKey = formatDateInput(now);
  const currentYear = currentMonthKey.slice(0, 4);

  const months = new Map<string, MonthGroup<T>>();
  for (const r of rentals) {
    const dayKey = formatDateInput(r.startAt);
    const monthKey = dayKey.slice(0, 7);

    let month = months.get(monthKey);
    if (!month) {
      const sameYear = monthKey.slice(0, 4) === currentYear;
      const formatter = sameYear ? MONTH_FORMATTER_SAME_YEAR : MONTH_FORMATTER_OTHER_YEAR;
      month = {
        key: monthKey,
        label: capitalize(formatter.format(r.startAt)),
        isCurrentMonth: monthKey === currentMonthKey,
        rentals: [],
        days: [],
      };
      months.set(monthKey, month);
    }
    month.rentals.push(r);

    if (month.isCurrentMonth) {
      let day = month.days.find((d) => d.key === dayKey);
      if (!day) {
        const dayNumber = Number(dayKey.slice(8, 10));
        day = { key: dayKey, label: dayKey === todayKey ? "Hoy" : `Día ${dayNumber}`, rentals: [] };
        month.days.push(day);
      }
      day.rentals.push(r);
    }
  }

  return Array.from(months.values());
}
