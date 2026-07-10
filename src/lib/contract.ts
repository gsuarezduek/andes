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
  dailyRate?: number; // $ por día
  days?: number;
  insuranceAmount?: number; // seguro con franquicia
  kmIncluded?: number; // km para uso
  extraKmRate?: number; // $ por km extra
  extraHourRate?: number; // $ por hora extra
  accessoriesDesc?: string;
  accessoriesAmount?: number;
  total?: number; // total a pagar
  paid?: number; // paga
  balance?: number; // saldo
  deposit?: number; // excedentes / depósito en garantía
};

/** Campos monetarios de ContractPricing, con etiqueta, para formularios y acta. */
export const PRICING_FIELDS: { key: keyof ContractPricing; label: string; money: boolean }[] = [
  { key: "dailyRate", label: "Precio por día", money: true },
  { key: "days", label: "Cantidad de días", money: false },
  { key: "insuranceAmount", label: "Seguro con franquicia", money: true },
  { key: "kmIncluded", label: "Km para uso", money: false },
  { key: "extraKmRate", label: "Km extra ($ c/u)", money: true },
  { key: "extraHourRate", label: "Hora extra ($ c/u)", money: true },
  { key: "accessoriesAmount", label: "Accesorios", money: true },
  { key: "total", label: "Total a pagar", money: true },
  { key: "paid", label: "Paga", money: true },
  { key: "balance", label: "Saldo", money: true },
  { key: "deposit", label: "Excedentes / depósito", money: true },
];

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
  maximumFractionDigits: 0,
});

export function formatArs(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return arsFormatter.format(n);
}
