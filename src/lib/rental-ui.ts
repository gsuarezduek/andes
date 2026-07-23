import type { RentalStatus } from "@prisma/client";

export type BadgeTone = "neutral" | "green" | "amber" | "red" | "blue" | "orange";

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
      return { label: "Activo", tone: "green" };
    case "finished":
      return { label: "Finalizado", tone: "neutral" };
    default: // reserved
      return bookingConfirmed
        ? { label: "Confirmado", tone: "amber" }
        : { label: "Pendiente", tone: "orange" };
  }
}
