import type { RentalStatus } from "@prisma/client";
import type { PaymentAccent } from "@/lib/rental-payments";

export type BadgeTone = "neutral" | "emerald" | "amber" | "red" | "blue" | "orange";

/**
 * Nombre y color "oficiales" del estado de un alquiler: los mismos que usa el
 * Calendario. "reserved" se separa en Confirmado/Pendiente según
 * `bookingConfirmed` — un solo badge, en vez de "Reservado" + "Sin confirmar"
 * aparte. Usar esta función en cualquier lugar que muestre el estado de un
 * alquiler (listado, detalle, dashboard, etc.) para que el nombre/color no
 * diverja del Calendario.
 */
export function rentalStatusDisplay(
  status: RentalStatus,
  bookingConfirmed: boolean,
): { label: string; tone: BadgeTone } {
  switch (status) {
    case "cancelled":
      return { label: "Cancelado", tone: "red" };
    case "active":
      return { label: "Activo", tone: "emerald" };
    case "finished":
      return { label: "Finalizado", tone: "neutral" };
    default: // reserved
      return bookingConfirmed
        ? { label: "Confirmado", tone: "amber" }
        : { label: "Pendiente", tone: "orange" };
  }
}

/**
 * Borde izquierdo para filas/barras (Calendario, listado de Alquileres,
 * Home): marca si una reserva Activa/Confirmada está pagada o no, sin pisar
 * el color de fondo que ya indica el estado. `border-l-transparent` reserva
 * el espacio para que las filas no salten de ancho entre sí.
 */
export function paymentBorderClass(accent: PaymentAccent): string {
  if (accent === "complete") return "border-l-4 border-l-emerald-500";
  if (accent === "pending") return "border-l-4 border-l-red-500";
  return "border-l-4 border-l-transparent";
}

/** Ring para el Badge de estado (pill): mismo criterio de color que `paymentBorderClass`. */
export function paymentRingClass(accent: PaymentAccent): string {
  if (accent === "complete") return "ring-2 ring-emerald-500";
  if (accent === "pending") return "ring-2 ring-red-500";
  return "";
}

/**
 * Un alquiler queda "atrasado" cuando pasó el momento en que algo debía
 * suceder y todavía no pasó: una reserva que debía entregarse y sigue en
 * `reserved` (sección "Atrasadas para entregar" del listado), o un auto
 * `active` cuya devolución ya venció. `finished`/`cancelled` nunca lo están.
 */
export function isRentalOverdue(status: RentalStatus, startAt: Date, endAt: Date, now: Date): boolean {
  if (status === "reserved") return startAt < now;
  if (status === "active") return endAt < now;
  return false;
}

/**
 * Borde izquierdo de fila: el atraso operativo (rojo) tiene prioridad sobre
 * el acento de pago — es la alerta más urgente para quien abre el listado.
 * El acento de pago sigue mostrándose aparte (texto "Falta $X").
 */
export function rentalRowBorderClass(accent: PaymentAccent, overdue: boolean): string {
  if (overdue) return "border-l-4 border-l-red-500";
  return paymentBorderClass(accent);
}
