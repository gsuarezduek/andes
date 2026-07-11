import "server-only";
import QRCode from "qrcode";
import { env } from "@/lib/env";

/**
 * Deep link que codifica el QR pegado en cada auto. Al escanearlo abre la
 * landing `/v/[id]` (acciones rápidas de entrega/devolución del vehículo).
 * Usa la URL pública de la app; si no está seteada cae a localhost (dev).
 */
export function vehicleDeepLink(vehicleId: string): string {
  return `${env.appUrl.replace(/\/$/, "")}/v/${vehicleId}`;
}

/** Genera el QR como SVG (string) listo para incrustar e imprimir. */
export function qrSvg(data: string): Promise<string> {
  return QRCode.toString(data, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    width: 256,
  });
}
