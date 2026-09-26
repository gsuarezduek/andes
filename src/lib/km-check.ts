/**
 * Chequeos de sentido común sobre el kilometraje que se carga en una entrega
 * o devolución. Pura y sin dependencias. El km mal tipeado (un dígito de más
 * o de menos) es el error de carga más caro: la liquidación de la devolución
 * cobra km extra a partir de él, y una vez firmada el acta no se puede
 * corregir. Por eso el wizard avisa y pide confirmar — no bloquea, para no
 * trabar la entrega parado en un aeropuerto cuando el km raro es real.
 */

// Un auto que va a entregarse no debería tener menos km que el último registrado
// (el odómetro no baja), salvo por unos pocos km de diferencia entre lecturas.
export const HANDOVER_KM_BELOW_TOLERANCE = 20;
// ...ni muchos más: entre la última devolución y la nueva entrega el auto casi no se mueve.
export const HANDOVER_KM_ABOVE_LIMIT = 1000;
// Recorrido máximo razonable por día de alquiler.
export const RETURN_KM_PER_DAY_LIMIT = 1000;

const fmt = (n: number) => n.toLocaleString("es-AR");

/**
 * Entrega: compara el km cargado contra el último km registrado del auto
 * (`currentKm`, que el wizard precarga). Devuelve el texto del aviso, o null si
 * el km es razonable.
 */
export function checkHandoverKm(km: number, currentKm: number): string | null {
  if (!Number.isFinite(km) || !Number.isFinite(currentKm)) return null;
  if (km < currentKm - HANDOVER_KM_BELOW_TOLERANCE) {
    return `El km cargado (${fmt(km)}) es menor al último registrado del auto (${fmt(currentKm)}). El odómetro no baja: puede faltar un dígito.`;
  }
  if (km > currentKm + HANDOVER_KM_ABOVE_LIMIT) {
    return `El km cargado (${fmt(km)}) es ${fmt(km - currentKm)} km más que el último registrado del auto (${fmt(currentKm)}). Revisá que no sobre un dígito.`;
  }
  return null;
}

/**
 * Devolución: compara el recorrido (km de devolución − km de entrega) contra un
 * tope de km por día. `days` = días pactados del alquiler (mínimo 1). Devuelve el
 * texto del aviso, o null si el recorrido es razonable.
 */
export function checkReturnKm(km: number, handoverKm: number, days: number | null | undefined): string | null {
  if (!Number.isFinite(km) || !Number.isFinite(handoverKm)) return null;
  const rentalDays = Math.max(1, Number.isFinite(days) ? Number(days) : 1);
  const driven = km - handoverKm;
  const limit = RETURN_KM_PER_DAY_LIMIT * rentalDays;
  if (driven > limit) {
    return `Con este km el cliente recorrió ${fmt(driven)} km en ${rentalDays} ${rentalDays === 1 ? "día" : "días"} (entrega: ${fmt(handoverKm)} km). Se le cobraría km extra por esa diferencia: revisá que no sobre un dígito.`;
  }
  return null;
}
