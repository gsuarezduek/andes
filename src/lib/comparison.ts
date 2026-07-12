/**
 * Comparación entrega vs devolución. Lógica pura (sin DB ni React) para poder
 * testearla y compartirla entre el wizard de devolución
 * (`inspection-wizard.tsx`), el acta PDF (`src/lib/acta/index.ts`) y, más
 * adelante, la liquidación (`src/lib/settlement.ts`).
 *
 * Convenciones del proyecto: km entero, nafta en octavos (0–8).
 */
export type ComparisonInput = {
  handoverKm: number;
  returnKm: number;
  handoverFuel: number;
  returnFuel: number;
  /** Cantidad de daños marcados en la devolución (todos son nuevos por diseño del croquis). */
  newDamages: number;
};

export type Comparison = {
  handoverKm: number;
  returnKm: number;
  /** Km recorridos = km de devolución − km de entrega. */
  kmDriven: number;
  handoverFuel: number;
  returnFuel: number;
  /** Diferencia de nafta en octavos (negativo = devuelve con menos). */
  fuelDiff: number;
  newDamages: number;
};

export function computeComparison(input: ComparisonInput): Comparison {
  return {
    handoverKm: input.handoverKm,
    returnKm: input.returnKm,
    kmDriven: input.returnKm - input.handoverKm,
    handoverFuel: input.handoverFuel,
    returnFuel: input.returnFuel,
    fuelDiff: input.returnFuel - input.handoverFuel,
    newDamages: input.newDamages,
  };
}
