/**
 * Datos del contrato de MDZ Rent a Car (encabezado, condiciones económicas y
 * checklist canónico), tomados del contrato en papel vigente. Compartido entre
 * el seed, el wizard de entrega y el acta PDF.
 */

import type { Currency } from "@/lib/currency";

export const COMPANY = {
  name: "MDZ Rent a Car",
  legalName: "DUEK RENT SAS",
  cuit: "30-71823917-2",
  address: "Martin Zapata 355, Ciudad, Mendoza",
  phone: "+54 9 261 2306787",
  web: "www.mdzrentacar.com",
} as const;

/**
 * Condiciones económicas del contrato. Se registran para el acta, sin cobro
 * (los pagos están fuera de la v1). Todos los campos son opcionales.
 */
export type ContractPricing = {
  place?: string; // lugar de retiro/devolución
  dailyRate?: number; // $ por día (se precarga de VikRentCar: car_cost/days)
  days?: number; // cantidad de días (se precarga de VikRentCar: days)
  insuranceUpgrade?: boolean; // "Mejora de Seguro": baja la franquicia (destacado)
  // Franquicia/Garantía: un solo importe que es a la vez el deducible del
  // seguro (impreso en el acta) y la garantía tomada en la entrega (`deposit`,
  // que cubre daños en la liquidación de la devolución — nunca km/nafta).
  deductible?: number;
  kmPerDay?: number; // km incluidos por día
  extraKmRate?: number; // $ por km extra
  kmPacks?: number; // packs de KM adicionales contratados (0–20, 200 km c/u)
  kmPackPrice?: number; // $ por pack de KM
  unlimitedKm?: boolean; // "KM libres": sin límite, no se cobra excedente
  extraHourPercent?: number; // hora extra como % de la tarifa diaria
  kmIncluded?: number; // (compat) km para uso — reemplazado por kmPerDay
  extraHourRate?: number; // (compat) $ por hora extra — hoy derivado de extraHourPercent
  accessoriesDesc?: string;
  accessoriesAmount?: number;
  total?: number; // total a pagar
  sena?: number; // seña / entrega a cuenta
  paid?: number; // paga (lo abonado ahora)
  balance?: number; // saldo (total − seña − paga)
  deposit?: number; // garantía tomada en la entrega (= deductible); cubre daños en la devolución
  guaranteeForm?: string; // forma de la garantía (efectivo, tarjeta, etc.) — entrega
  // Medios de pago con los que se cobró "Paga" (entrega). `paid` es la suma de
  // `adjustedAmount` de estas líneas — dejó de tipearse a mano.
  payments?: RentalPayment[];
};

/**
 * Una línea de pago cargada en la entrega (medio de pago elegido + importe).
 * Snapshot al momento de cargarla: si el medio de pago cambia de nombre o %
 * después, esta línea no se ve afectada (la inspección es inmutable).
 */
export type RentalPayment = {
  methodId?: string; // referencia informativa al PaymentMethod (puede haber sido borrado)
  methodName: string;
  adjustmentPercent?: number; // % al momento de cargar el pago (+ recargo, − descuento)
  amount: number; // importe base cargado por el empleado
  adjustedAmount: number; // amount ajustado por el %; es lo que suma a "Paga"
  // Aclaración libre, obligatoria cuando el medio elegido tenía `requiresNote`
  // (ej. "Otro"): indica a dónde fue el pago.
  note?: string;
  // Id del CashMovement que YA representa esta línea en Caja (creado por
  // "Agregar pago" o por el import automático de VikRentCar). Presente ⇒
  // saveHandover/saveReturn NO deben volver a crear un movimiento para esta
  // línea al guardar — evita contarla dos veces.
  cashMovementId?: string;
  // true = el medio de pago es un placeholder (no se pudo resolver a un medio
  // real de Andes) y todavía necesita que alguien lo confirme.
  unconfirmed?: boolean;
};

/** Cómo se formatea/edita cada campo de pricing. */
export type PricingKind = "money" | "int" | "percent";

/** Campos de ContractPricing, con etiqueta y tipo, para formularios y acta. */
export const PRICING_FIELDS: { key: keyof ContractPricing; label: string; kind: PricingKind }[] = [
  { key: "dailyRate", label: "Precio por día", kind: "money" },
  { key: "days", label: "Cantidad de días", kind: "int" },
  { key: "kmPerDay", label: "Km por día", kind: "int" },
  { key: "extraKmRate", label: "Km extra ($ c/u)", kind: "money" },
  { key: "kmPacks", label: "Packs de KM (200 km c/u)", kind: "int" },
  { key: "extraHourPercent", label: "Hora extra (% de la tarifa)", kind: "percent" },
  { key: "accessoriesAmount", label: "Accesorios", kind: "money" },
  { key: "total", label: "Total a pagar", kind: "money" },
  { key: "sena", label: "Seña", kind: "money" },
  { key: "paid", label: "Paga", kind: "money" },
  { key: "balance", label: "Saldo", kind: "money" },
];

/** Km que suma cada pack de KM adicional. */
export const KM_PACK_SIZE = 200;
/** Cantidad máxima de packs de KM por alquiler. */
export const KM_PACK_MAX = 20;

/** Km adicionales comprados en packs (packs × 200). 0 si no hay packs cargados. */
export function kmPackKm(p: Pick<ContractPricing, "kmPacks">): number {
  return Math.max(0, Math.round(p.kmPacks ?? 0)) * KM_PACK_SIZE;
}

/**
 * Importe final de una línea de pago tras aplicar el % del medio (+ recargo,
 * − descuento). Sin condición (`percent` null/undefined/0) devuelve el mismo
 * importe.
 */
export function paymentAdjustedAmount(amount: number, percent?: number | null): number {
  const v = amount * (1 + (percent ?? 0) / 100);
  return Number.isFinite(v) ? roundMoney(v) : amount;
}

/**
 * Importe total de los packs de KM (packs × precio del pack). `null` si no
 * hay packs cargados o falta el precio (el precio no se edita en el wizard:
 * se precarga de Configuración → Condiciones y viaja oculto en `pricing`).
 */
export function kmPackAmount(p: Pick<ContractPricing, "kmPacks" | "kmPackPrice">): number | null {
  const packs = Math.max(0, Math.round(p.kmPacks ?? 0));
  if (packs <= 0 || p.kmPackPrice == null) return null;
  const v = packs * p.kmPackPrice;
  return Number.isFinite(v) ? roundMoney(v) : null;
}

/**
 * Importe de la hora extra derivado del % sobre la tarifa diaria.
 * `null` si falta la tarifa o el porcentaje.
 */
export function extraHourAmount(p: Pick<ContractPricing, "dailyRate" | "extraHourPercent">): number | null {
  if (p.dailyRate == null || p.extraHourPercent == null) return null;
  const v = (p.dailyRate * p.extraHourPercent) / 100;
  return Number.isFinite(v) ? roundMoney(v) : null;
}

/**
 * Saldo sugerido = total − seña − paga. `null` si no hay total cargado (sin
 * base no hay saldo que calcular). El empleado puede sobrescribirlo.
 */
export function computeBalance(
  p: Pick<ContractPricing, "total" | "sena" | "paid">,
): number | null {
  if (p.total == null || Number.isNaN(p.total)) return null;
  const v = p.total - (p.sena ?? 0) - (p.paid ?? 0);
  return Number.isFinite(v) ? roundMoney(v) : null;
}

/** Redondea a centavos (2 decimales), evitando el ruido de punto flotante. */
export function roundMoney(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Checklist de verificación del contrato (entrega). Configurable por el admin. */
export const CANONICAL_CHECKLIST = [
  "Lavado y aspirado",
  "Nivel de combustible: mismo nivel o superior",
  "Tablero sin testigos de alerta",
  "Arranque correcto",
  "Llave y cerradura en correcto funcionamiento",
  "Seguro vigente",
  "Tarjeta verde",
  "Documentación completa en guantera",
  "Kit de seguridad completo",
  "Gato y llave cruz en baúl",
  "Tuerca de seguridad",
  "Exterior filmado / fotografías tomadas",
  "Sin daños por granizo",
  "Vidrios en buen estado",
  "Ópticas delanteras y traseras OK",
  "Luces probadas (altas, bajas, giro, stop)",
  "Cubiertas en buen estado",
  "Espejos exteriores OK",
  "Plásticos interiores en buen estado",
  "Tapizados en buen estado",
  "Alfombras completas y limpias",
  "Levanta cristales funcionando",
  "Perfume / accesorios completos",
];

const arsFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatArs(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return arsFormatter.format(n);
}

// "es-AR" con moneda USD da "US$ …" (distinto del "$" de ARS) — es el
// formato que ya usa el dueño para distinguirlos a mano.
const usdFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatMoney(n: number | null | undefined, currency: Currency): string {
  if (n == null || Number.isNaN(n)) return "—";
  return currency === "usd" ? usdFormatter.format(n) : arsFormatter.format(n);
}
