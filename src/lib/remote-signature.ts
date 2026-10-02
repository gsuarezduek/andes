/**
 * Firma remota: el cliente firma en su propio teléfono escaneando un QR que el
 * empleado muestra en su pantalla. Tipos y reglas compartidas entre el wizard,
 * el server action que crea el pedido y las rutas públicas /api/sign.
 */

/** Fila etiqueta/valor ya formateada para mostrar (condiciones, liquidación). */
export type SummaryRow = { label: string; value: string };

/** Resumen que se le muestra al cliente para que sepa qué está firmando. */
export type SignatureSummary = {
  vehicleLabel: string;
  km: number;
  fuelLevel: number;
  /** Divisiones del tanque de este vehículo (Vehicle.fuelLevels, 4–16). Los
   *  pedidos viejos no lo tienen: se asume 8 (el default histórico). */
  maxFuel?: number;
  newDamages: string[];
  observations?: string;
  clientName?: string;
  datesLabel?: string;
  /**
   * Condiciones económicas del contrato ya formateadas (entrega). Es lo que el
   * cliente lee y acepta; se arma con la misma lógica que el acta.
   */
  conditions?: SummaryRow[];
  /** Liquidación ya formateada (devolución): km extra, nafta, daños, depósito. */
  settlementRows?: SummaryRow[];
  /**
   * Filas finales destacadas de la liquidación (devolución): saldo a cobrar
   * y/o depósito a devolver, ya formateados. Pueden coexistir (la garantía
   * solo cubre daños; el km extra/nafta se cobran aparte).
   */
  balanceRows?: SummaryRow[];
};

/**
 * Vida útil del pedido de firma (3 horas). Antes se generaba recién en el
 * paso "Firma" (30 min alcanzaban); ahora puede arrancar desde el paso
 * "Datos" y acompañar toda la entrega/devolución, así que el servidor la
 * renueva en cada actualización de progreso (`updateRemoteSignatureProgress`)
 * — esta constante es el margen antes de darlo por abandonado si el
 * empleado deja de tocar el wizard.
 */
export const SIGNATURE_REQUEST_TTL_MS = 3 * 60 * 60 * 1000;

/**
 * True si el pedido sigue firmable: pendiente y no vencido. Pura y testeable.
 */
export function isSignatureRequestUsable(
  req: { status: string; expiresAt: Date },
  now: Date,
): boolean {
  return req.status === "pending" && req.expiresAt.getTime() > now.getTime();
}

/** Datos de contacto del cliente tal como viven en `Rental`. */
export type ClientFields = {
  name: string;
  email: string | null;
  phone: string | null;
  docNumber: string | null;
  address: string | null;
};

export const CLIENT_FIELD_KEYS = ["name", "email", "phone", "docNumber", "address"] as const;
export type ClientFieldKey = (typeof CLIENT_FIELD_KEYS)[number];

/** true si el nombre está vacío o es el sentinel "Sin nombre" que deja el
 *  sync cuando VikRentCar no lo trae (ver `src/lib/sync/client-name.ts`). */
export function isClientNameMissing(name: string): boolean {
  const trimmed = name.trim();
  return !trimmed || trimmed.toLowerCase() === "sin nombre";
}

/**
 * Claves de `ClientFields` que están vacías — las que el cliente puede
 * completar él mismo desde /sign/[id] sin pisar un dato que el staff ya
 * cargó.
 */
export function missingClientFields(client: ClientFields): ClientFieldKey[] {
  const missing: ClientFieldKey[] = [];
  if (isClientNameMissing(client.name)) missing.push("name");
  if (!client.email?.trim()) missing.push("email");
  if (!client.phone?.trim()) missing.push("phone");
  if (!client.docNumber?.trim()) missing.push("docNumber");
  if (!client.address?.trim()) missing.push("address");
  return missing;
}
