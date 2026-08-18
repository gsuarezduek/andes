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
