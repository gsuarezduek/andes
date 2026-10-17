import type { Currency } from "@/lib/currency";
import { roundMoney } from "@/lib/contract";

/** Configuración de comisión de un medio de pago (ver `PaymentMethod.commissionPercent`). */
export type CommissionConfig = {
  percent: number | null;
  /** Monto fijo en pesos — solo se aplica a ingresos en ARS. */
  fixed: number | null;
};

/**
 * Comisión de un movimiento (ingreso o egreso): `percent`% del monto (en
 * cualquier moneda) más el monto fijo (solo si el movimiento es en pesos — un
 * fijo en pesos no tiene sentido sobre un monto en dólares). `null` si no hay
 * nada que cobrar. Pura y testeable.
 */
export function computeCommission(
  movement: { amount: number; currency: Currency },
  config: CommissionConfig,
): number | null {
  const percentPart = config.percent && config.percent > 0 ? (movement.amount * config.percent) / 100 : 0;
  const fixedPart = config.fixed && config.fixed > 0 && movement.currency === "ars" ? config.fixed : 0;
  const total = roundMoney(percentPart + fixedPart);
  return total > 0 ? total : null;
}

/** Categoría de egreso a la que apunta una comisión — `null` = sin categoría. */
export type CommissionCategoryRef = { id: string; name: string } | null;

/** `%`/monto fijo/categoría ya resueltos — lo que `computeCommission` necesita más la categoría del egreso derivado. */
export type ResolvedCommissionConfig = { percent: number | null; fixed: number | null; category: CommissionCategoryRef };

/** Los campos de `PaymentMethod` que hacen falta para resolver su comisión por egreso. */
export type ExpenseCommissionSource = {
  expenseCommissionMode: "none" | "same" | "custom";
  commissionPercent: number | null;
  commissionFixed: number | null;
  commissionCategory: CommissionCategoryRef;
  expenseCommissionPercent: number | null;
  expenseCommissionFixed: number | null;
  expenseCommissionCategory: CommissionCategoryRef;
};

/**
 * Resuelve la configuración de comisión por egreso de una cuenta según su
 * modo (ver `PaymentMethod.expenseCommissionMode` en el schema): `none` → sin
 * comisión; `same` → espeja en vivo el % / monto fijo / categoría de la
 * comisión por ingreso de la misma cuenta (si esos valores cambian después,
 * se siguen solos — acá no se guarda una copia); `custom` → usa los campos
 * propios de la comisión por egreso. Pura y testeable.
 */
export function resolveExpenseCommissionConfig(method: ExpenseCommissionSource): ResolvedCommissionConfig | null {
  if (method.expenseCommissionMode === "none") return null;
  if (method.expenseCommissionMode === "same") {
    return { percent: method.commissionPercent, fixed: method.commissionFixed, category: method.commissionCategory };
  }
  return { percent: method.expenseCommissionPercent, fixed: method.expenseCommissionFixed, category: method.expenseCommissionCategory };
}
