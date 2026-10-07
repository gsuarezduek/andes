/**
 * Días especiales del equipo (feriados, cierres, etc.): lógica pura de
 * fechas/etiquetas, sin base de datos. Se resaltan en amarillo en Horarios
 * y en el Calendario de flota — ver `special-dates-queries.ts` para la
 * lectura/escritura.
 */

const MONTH_FORMATTER = new Intl.DateTimeFormat("es-AR", { month: "long", timeZone: "America/Argentina/Mendoza" });
const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("es-AR", { weekday: "long", timeZone: "America/Argentina/Mendoza" });

/** "2026-10-12" → "Lunes 12 de octubre" (sin año; se usa solo para fechas dentro de los próximos 30 días). */
export function formatSpecialDateLabel(key: string): string {
  const noon = new Date(`${key}T12:00:00Z`);
  const weekday = WEEKDAY_FORMATTER.format(noon);
  const day = Number(key.slice(8, 10));
  const month = MONTH_FORMATTER.format(noon);
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${day} de ${month}`;
}
