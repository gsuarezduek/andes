import type { Currency } from "@/lib/currency";
import { roundMoney } from "@/lib/contract";

/** Configuración de comisión de un medio de pago (ver `PaymentMethod.commissionPercent`). */
export type CommissionConfig = {
  percent: number | null;
  /** Monto fijo en pesos — solo se aplica a ingresos en ARS. */
  fixed: number | null;
};

/**
 * Comisión de un ingreso: `percent`% del monto (en cualquier moneda) más el
 * monto fijo (solo si el ingreso es en pesos — un fijo en pesos no tiene
 * sentido sobre un ingreso en dólares). `null` si no hay nada que cobrar.
 * Pura y testeable.
 */
export function computeCommission(
  income: { amount: number; currency: Currency },
  config: CommissionConfig,
): number | null {
  const percentPart = config.percent && config.percent > 0 ? (income.amount * config.percent) / 100 : 0;
  const fixedPart = config.fixed && config.fixed > 0 && income.currency === "ars" ? config.fixed : 0;
  const total = roundMoney(percentPart + fixedPart);
  return total > 0 ? total : null;
}
