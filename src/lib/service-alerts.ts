/** Default cuando `ConditionSettings.serviceOverdueRedPercent` no está configurado. */
export const DEFAULT_SERVICE_OVERDUE_RED_PERCENT = 15;

/**
 * Severidad de un auto ya vencido de service (`currentKm >= nextServiceKm`):
 * "amber" mientras el excedente no supere `redPercent`% del intervalo de
 * service del auto; "red" a partir de ahí. Sin `serviceIntervalKm`
 * configurado no hay base para una gracia proporcional, así que cualquier
 * excedente es directamente "red" (mismo criterio que antes de esta
 * configuración: vencido = rojo).
 */
export function serviceOverdueSeverity(
  currentKm: number,
  nextServiceKm: number,
  serviceIntervalKm: number | null,
  redPercent: number,
): "amber" | "red" {
  const overshoot = currentKm - nextServiceKm;
  const graceKm =
    serviceIntervalKm != null && serviceIntervalKm > 0 ? (serviceIntervalKm * redPercent) / 100 : 0;
  return overshoot > graceKm ? "red" : "amber";
}

/** Opciones rápidas del modal "Posponer" (además de un valor libre). */
export const SNOOZE_KM_PRESETS = [500, 1000, 2000] as const;
export const SNOOZE_DAY_PRESETS = [7, 15, 30] as const;

/**
 * ¿La alerta de service de este auto está pospuesta ahora? Pospuesta por km
 * mientras el km actual no llegue al tope; por tiempo mientras no pase la
 * fecha. Sin ninguno de los dos cargados, no está pospuesta.
 */
export function isServiceAlertSnoozed(
  v: { currentKm: number; serviceSnoozedUntilKm: number | null; serviceSnoozedUntil: Date | null },
  now: Date,
): boolean {
  if (v.serviceSnoozedUntilKm != null && v.currentKm < v.serviceSnoozedUntilKm) return true;
  if (v.serviceSnoozedUntil != null && now < v.serviceSnoozedUntil) return true;
  return false;
}
