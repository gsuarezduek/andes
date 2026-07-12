/**
 * Liquidación de la devolución. Lógica pura (sin DB ni React) para testearla y
 * compartirla entre el wizard de devolución, la persistencia y el acta PDF.
 *
 * Cierra el círculo económico: a partir de la comparación entrega↔devolución y
 * de las condiciones del contrato (`Rental.pricing`), calcula el excedente de
 * km, la nafta faltante y los cargos por daño nuevo, los contrasta con el
 * depósito en garantía y arroja el saldo. **No procesa cobros** (pagos fuera de
 * alcance): sólo calcula y registra cómo se saldó.
 *
 * Convenciones: importes enteros en ARS, km entero, nafta en octavos (0–8).
 */
import type { ContractPricing } from "@/lib/contract";

export type SettlementMethod =
  | "efectivo"
  | "transferencia"
  | "retencion_deposito"
  | "none";

export type SettlementDamageCharge = { description: string; amount: number };

export type Settlement = {
  kmDriven: number;
  includedKm: number; // km incluidos por contrato (kmPerDay × days), 0 = sin límite
  extraKm: number;
  extraKmRate: number;
  extraKmCharge: number;
  fuelMissingEighths: number; // octavos de nafta faltantes (contexto; no se cobra solo)
  fuelCharge: number; // importe manual por nafta (default 0)
  damageCharges: SettlementDamageCharge[];
  damagesTotal: number;
  subtotal: number; // extraKmCharge + fuelCharge + damagesTotal
  deposit: number; // depósito/excedente tomado en la entrega
  depositApplied: number; // parte del depósito que cubre el subtotal
  balanceDue: number; // lo que el cliente aún debe tras aplicar el depósito
  depositReturn: number; // depósito a devolver si el subtotal no lo consume
  method: SettlementMethod;
  note?: string;
};

export type SettlementInput = {
  handoverKm: number;
  returnKm: number;
  handoverFuel: number;
  returnFuel: number;
  pricing?: Pick<ContractPricing, "kmPerDay" | "days" | "extraKmRate" | "deposit"> | null;
  newDamages?: { description?: string }[];
};

function round(n: number): number {
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/**
 * Recalcula los totales (subtotal, depósito aplicado, saldo) a partir de las
 * líneas — que el empleado puede haber editado. Pura e idempotente.
 */
export function rollupSettlement(s: Settlement): Settlement {
  const damagesTotal = round(s.damageCharges.reduce((a, d) => a + (d.amount || 0), 0));
  const subtotal = round((s.extraKmCharge || 0) + (s.fuelCharge || 0) + damagesTotal);
  const deposit = s.deposit || 0;
  const depositApplied = Math.min(subtotal, deposit);
  const balanceDue = Math.max(0, subtotal - deposit);
  const depositReturn = Math.max(0, deposit - subtotal);
  return { ...s, damagesTotal, subtotal, depositApplied, balanceDue, depositReturn };
}

/** Liquidación inicial autocalculada desde las condiciones de la entrega. */
export function computeSettlement(input: SettlementInput): Settlement {
  const kmDriven = Math.max(0, input.returnKm - input.handoverKm);
  const kmPerDay = input.pricing?.kmPerDay ?? 0;
  const days = input.pricing?.days ?? 0;
  const includedKm = kmPerDay > 0 && days > 0 ? kmPerDay * days : 0;
  // Sin km incluido pactado no se cobra excedente (no hay límite).
  const extraKm = includedKm > 0 ? Math.max(0, kmDriven - includedKm) : 0;
  const extraKmRate = input.pricing?.extraKmRate ?? 0;
  const extraKmCharge = round(extraKm * extraKmRate);

  const fuelMissingEighths = Math.max(0, input.handoverFuel - input.returnFuel);

  const damageCharges: SettlementDamageCharge[] = (input.newDamages ?? []).map((d, i) => ({
    description: d.description?.trim() || `Daño #${i + 1}`,
    amount: 0,
  }));

  return rollupSettlement({
    kmDriven,
    includedKm,
    extraKm,
    extraKmRate,
    extraKmCharge,
    fuelMissingEighths,
    fuelCharge: 0,
    damageCharges,
    damagesTotal: 0,
    subtotal: 0,
    deposit: input.pricing?.deposit ?? 0,
    depositApplied: 0,
    balanceDue: 0,
    depositReturn: 0,
    method: "none",
  });
}
