/**
 * Datos del contrato de MDZ Rent a Car (encabezado, condiciones económicas y
 * checklist canónico), tomados del contrato en papel vigente. Compartido entre
 * el seed, el wizard de entrega y el acta PDF.
 */

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
};

/** Cómo se formatea/edita cada campo de pricing. */
export type PricingKind = "money" | "int" | "percent";

/** Campos de ContractPricing, con etiqueta y tipo, para formularios y acta. */
export const PRICING_FIELDS: { key: keyof ContractPricing; label: string; kind: PricingKind }[] = [
  { key: "dailyRate", label: "Precio por día", kind: "money" },
  { key: "days", label: "Cantidad de días", kind: "int" },
  { key: "kmPerDay", label: "Km por día", kind: "int" },
  { key: "extraKmRate", label: "Km extra ($ c/u)", kind: "money" },
  { key: "extraHourPercent", label: "Hora extra (% de la tarifa)", kind: "percent" },
  { key: "accessoriesAmount", label: "Accesorios", kind: "money" },
  { key: "total", label: "Total a pagar", kind: "money" },
  { key: "sena", label: "Seña", kind: "money" },
  { key: "paid", label: "Paga", kind: "money" },
  { key: "balance", label: "Saldo", kind: "money" },
];

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
function roundMoney(v: number): number {
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
