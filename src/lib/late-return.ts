/**
 * Devolución tardía: el auto volvió después de la fecha/hora pactada
 * (`Rental.endAt`) y nadie extendió el alquiler antes. Lógica pura (sin DB ni
 * React) para testearla y compartirla entre el wizard de devolución, la
 * persistencia y el acta.
 *
 * Es el caso que la extensión no cubre: `extendRental` solo corre con el
 * alquiler `active` (ver `rental-flags.ts`), así que una vez cerrada la
 * devolución ya no hay forma de cobrar el atraso. Acá se cobra como una línea
 * más de la liquidación — junto al km extra y la nafta faltante —, que es el
 * momento en que el atraso se conoce y queda firmado por el cliente.
 *
 * Si el cliente avisó y se extendió antes de devolver, `endAt` ya se movió y
 * no hay atraso que cobrar: el caso se resuelve solo, sin reglas especiales.
 */
import { roundMoney, type ContractPricing } from "@/lib/contract";
import { EXTRA_HOUR_DAY_THRESHOLD } from "@/lib/quote-estimate";

/** Horas extra que puede tener un atraso antes de ser un día completo: con el
 *  20% por hora de Condiciones, la 5ª hora ya iguala el 100% del día (ver
 *  `EXTRA_HOUR_DAY_THRESHOLD`), así que el resto nunca llega a 5. */
export const MAX_LATE_EXTRA_HOURS = EXTRA_HOUR_DAY_THRESHOLD - 1;

export type LateReturnBreakdown = {
  /** Días completos de 24 h de atraso. */
  days: number;
  /** Horas del resto, cobradas al `extraHourPercent` de las condiciones.
   *  Siempre 0–`MAX_LATE_EXTRA_HOURS`. */
  hours: number;
};

/**
 * Desglose del atraso en días y horas. Mismo criterio que el presupuestador
 * del calendario (`quoteDaysBreakdown`): días completos de 24 h y el resto
 * como horas extra, salvo que el resto ya iguale un día entero, donde se
 * cobra el día.
 *
 * Las horas se redondean **hacia arriba** — una hora empezada se cobra, igual
 * criterio que "un día empezado se cuenta entero" de `extensionExtraDays` —,
 * con un margen de un minuto para que un resto de segundos no se convierta en
 * una hora de cargo. Sin tolerancia de atraso: el minuto 1 ya es tarde.
 *
 * Devuelve ceros si el auto volvió en hora o antes.
 */
export function lateReturnBreakdown(endAt: Date, returnedAt: Date): LateReturnBreakdown {
  const none = { days: 0, hours: 0 };
  // Al minuto, igual que `quoteDaysBreakdown`.
  const diffHours = Math.round((returnedAt.getTime() - endAt.getTime()) / 60_000) / 60;
  if (!Number.isFinite(diffHours) || diffHours < 1 / 60) return none;
  const fullDays = Math.floor(diffHours / 24);
  const restHours = diffHours - fullDays * 24;
  const hours = restHours < 1 / 60 ? 0 : Math.ceil(restHours);
  // 5 horas al 20% ya son el 100% de un día: se cobra el día, no las horas.
  if (hours >= EXTRA_HOUR_DAY_THRESHOLD) return { days: fullDays + 1, hours: 0 };
  return { days: fullDays, hours };
}

/** True si hay algo que cobrar por el atraso. */
export function isLateReturn(b: LateReturnBreakdown): boolean {
  return b.days > 0 || b.hours > 0;
}

/**
 * Cargo sugerido por el atraso: tarifa diaria × días + el % de hora extra ×
 * horas. `null` si falta la tarifa diaria del contrato — el empleado carga el
 * importe a mano, mismo criterio que `suggestedExtensionAmount`.
 *
 * Sin `extraHourPercent` configurado en Condiciones, cualquier resto de horas
 * se cobra como un día completo más — el criterio del resto del sistema (ver
 * `estimateQuoteTotal`), no gratis.
 */
export function lateReturnCharge(
  pricing: Pick<ContractPricing, "dailyRate" | "extraHourPercent"> | null | undefined,
  breakdown: LateReturnBreakdown,
): number | null {
  const dailyRate = pricing?.dailyRate;
  if (dailyRate == null || !Number.isFinite(dailyRate)) return null;
  if (!isLateReturn(breakdown)) return 0;
  const percent = pricing?.extraHourPercent;
  if (breakdown.hours > 0 && percent == null) {
    return roundMoney(dailyRate * (breakdown.days + 1));
  }
  const hoursAmount = breakdown.hours > 0 ? dailyRate * (percent! / 100) * breakdown.hours : 0;
  return roundMoney(dailyRate * breakdown.days + hoursAmount);
}

/** Detalle corto para el acta y la UI: "1 d 2 h", "3 h", "" si no hay atraso.
 *  Sin palabras, para no pluralizar en dos idiomas. */
export function lateReturnDetail(b: LateReturnBreakdown): string {
  if (!isLateReturn(b)) return "";
  return [b.days > 0 ? `${b.days} d` : "", b.hours > 0 ? `${b.hours} h` : ""].filter(Boolean).join(" ");
}
