import type { RentalStatus } from "@prisma/client";
import type { CalendarBar } from "@/lib/calendar";
import { rentalStatusDisplay, paymentBorderClass } from "@/lib/rental-ui";

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
      return "bg-emerald-600/90 text-white hover:bg-emerald-600 hover:ring-emerald-300";
    case "finished":
      return "bg-slate-400/90 text-white hover:ring-slate-300";
    case "out_of_service":
      return "bg-blue-600/90 text-white hover:bg-blue-600 hover:ring-blue-300";
    default: // reserved
      return bar.confirmed
        ? "bg-amber-400 text-amber-950 hover:bg-amber-400/90 hover:ring-amber-300" // Confirmado (pagado)
        : "bg-orange-500/90 text-white hover:bg-orange-500 hover:ring-orange-300"; // Pendiente
  }
}

/** Borde izquierdo según el pago (ver `paymentAccent` en src/lib/rental-payments.ts). */
export function paymentBorderClasses(bar: CalendarBar): string {
  return paymentBorderClass(bar.paymentAccent);
}

/** Clases de la barra de presupuesto (borrador, ver src/lib/rental-quotes.ts)
 *  — indigo punteado, color no usado por ningún estado real y el patrón
 *  punteado refuerza que "no es una reserva real". */
export function quoteBarClasses(): string {
  return "border-2 border-dashed border-indigo-500 bg-indigo-500/25 text-indigo-800 hover:bg-indigo-500/35 dark:text-indigo-200";
}

/** Chip del tooltip/detalle de presupuesto (mismo criterio que `chipClasses`). */
export function quoteChipClasses(): string {
  return "bg-indigo-500/20 text-indigo-700 dark:text-indigo-400";
}

/** Clases del chip de estado en el tooltip (fondo suave + texto). */
export function chipClasses(bar: CalendarBar): string {
  switch (bar.status) {
    case "cancelled":
      return "bg-red-500/20 text-red-700 dark:text-red-400";
    case "active":
      return "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400";
    case "finished":
      return "bg-slate-500/20 text-slate-600 dark:text-slate-300";
    case "out_of_service":
      return "bg-blue-500/20 text-blue-700 dark:text-blue-400";
    default: // reserved
      return bar.confirmed
        ? "bg-amber-500/20 text-amber-700 dark:text-amber-500"
        : "bg-orange-500/20 text-orange-700 dark:text-orange-400";
  }
}
