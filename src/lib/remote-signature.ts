/**
 * Firma remota: el cliente firma en su propio teléfono escaneando un QR que el
 * empleado muestra en su pantalla. Tipos y reglas compartidas entre el wizard,
 * el server action que crea el pedido y las rutas públicas /api/sign.
 */

/** Resumen que se le muestra al cliente para que sepa qué está firmando. */
export type SignatureSummary = {
  vehicleLabel: string;
  km: number;
  fuelLevel: number;
  newDamages: string[];
  observations?: string;
  clientName?: string;
  datesLabel?: string;
};

/** Vida útil del pedido de firma (30 min). */
export const SIGNATURE_REQUEST_TTL_MS = 30 * 60 * 1000;

/**
 * True si el pedido sigue firmable: pendiente y no vencido. Pura y testeable.
 */
export function isSignatureRequestUsable(
  req: { status: string; expiresAt: Date },
  now: Date,
): boolean {
  return req.status === "pending" && req.expiresAt.getTime() > now.getTime();
}
