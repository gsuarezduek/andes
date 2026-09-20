/**
 * Sugerido de total para un presupuesto del Calendario: tarifa de referencia
 * del auto × cantidad de días seleccionados. Pura y sin `server-only` a
 * propósito: se usa desde el Client Component del Calendario para calcular
 * el sugerido al instante (sin ida y vuelta al servidor) apenas se completa
 * la selección de días — un archivo con `server-only` bloquea el import
 * completo desde un componente cliente, incluso de una función pura (mismo
 * gotcha ya documentado en v28 de CLAUDE.md).
 */
export function estimateQuoteTotal(dailyRate: number | null, days: number): number | null {
  if (dailyRate == null || days <= 0) return null;
  return Math.round(dailyRate * days);
}
