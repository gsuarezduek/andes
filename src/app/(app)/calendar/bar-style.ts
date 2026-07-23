import type { RentalStatus } from "@prisma/client";
import type { CalendarBar } from "@/lib/calendar";
import { rentalStatusDisplay } from "@/lib/rental-ui";

/** Etiqueta de estado para el tooltip: la "oficial" (src/lib/rental-ui), la
 *  misma que se usa en el listado de Alquileres y el detalle del alquiler. */
export function statusLabel(bar: CalendarBar): string {
  return rentalStatusDisplay(bar.status as RentalStatus, bar.confirmed).label;
}

/** Clases de color de la barra según estado (ver leyenda en la página). */
export function barClasses(bar: CalendarBar): string {
  switch (bar.status) {
    case "cancelled":
      return "bg-red-600/90 text-white hover:bg-red-600 hover:ring-red-300";
    case "active":
      return "bg-green-600/90 text-white hover:bg-green-600 hover:ring-green-300";
    case "finished":
      return "bg-slate-400/90 text-white hover:ring-slate-300";
    default: // reserved
      return bar.confirmed
        ? "bg-amber-400 text-amber-950 hover:bg-amber-400/90 hover:ring-amber-300" // Confirmado (pagado)
        : "bg-orange-500/90 text-white hover:bg-orange-500 hover:ring-orange-300"; // Pendiente
  }
}

/** Clases del chip de estado en el tooltip (fondo suave + texto). */
export function chipClasses(bar: CalendarBar): string {
  switch (bar.status) {
    case "cancelled":
      return "bg-red-500/20 text-red-700 dark:text-red-400";
    case "active":
      return "bg-green-500/20 text-green-700 dark:text-green-400";
    case "finished":
      return "bg-slate-500/20 text-slate-600 dark:text-slate-300";
    default: // reserved
      return bar.confirmed
        ? "bg-amber-500/20 text-amber-700 dark:text-amber-500"
        : "bg-orange-500/20 text-orange-700 dark:text-orange-400";
  }
}
