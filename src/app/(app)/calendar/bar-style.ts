import type { RentalStatus } from "@prisma/client";
import type { CalendarBar, RoomCalendarBar } from "@/lib/calendar";
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
        : "bg-orange-500 text-white hover:bg-orange-500/90 hover:ring-orange-300"; // Pendiente (sólido)
  }
}

/** Borde izquierdo según el pago (ver `paymentAccent` en src/lib/rental-payments.ts). */
export function paymentBorderClasses(bar: CalendarBar): string {
  return paymentBorderClass(bar.paymentAccent);
}

/** Clases de la barra de presupuesto (borrador, ver src/lib/rental-quotes.ts)
 *  — mismo naranja que "Pendiente" (una consulta todavía sin confirmar),
 *  pero punteado y más transparente: Pendiente es sólido, esto no es una
 *  reserva real. */
export function quoteBarClasses(): string {
  return "border-2 border-dashed border-orange-500 bg-orange-500/20 text-orange-800 hover:bg-orange-500/30 dark:text-orange-200";
}

/** Chip del tooltip/detalle de presupuesto (mismo criterio que `chipClasses`). */
export function quoteChipClasses(): string {
  return "bg-orange-500/20 text-orange-700 dark:text-orange-400";
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

/** Color de una estadía de habitación según su procedencia (ver leyenda en la página). */
export function roomBarClasses(bar: RoomCalendarBar): string {
  if (bar.isBlock) return "bg-slate-500/70 text-white hover:ring-slate-300";
  switch (bar.source) {
    case "airbnb":
      return "bg-pink-500 text-white hover:bg-pink-500/90 hover:ring-pink-300";
    case "booking":
      return "bg-indigo-600 text-white hover:bg-indigo-600/90 hover:ring-indigo-300";
    case "manual":
      return "bg-teal-600 text-white hover:bg-teal-600/90 hover:ring-teal-300";
    default:
      return "bg-cyan-700 text-white hover:bg-cyan-700/90 hover:ring-cyan-300";
  }
}

/** Chip del tooltip de una estadía (fondo suave + texto). */
export function roomChipClasses(bar: RoomCalendarBar): string {
  if (bar.isBlock) return "bg-slate-500/20 text-slate-600 dark:text-slate-300";
  switch (bar.source) {
    case "airbnb":
      return "bg-pink-500/20 text-pink-700 dark:text-pink-400";
    case "booking":
      return "bg-indigo-500/20 text-indigo-700 dark:text-indigo-400";
    case "manual":
      return "bg-teal-500/20 text-teal-700 dark:text-teal-400";
    default:
      return "bg-cyan-500/20 text-cyan-700 dark:text-cyan-400";
  }
}
