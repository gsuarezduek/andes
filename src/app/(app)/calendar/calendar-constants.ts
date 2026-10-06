// Vista Mes/90 días: columnas angostas, sólo se ve qué días están ocupados.
export const COL_W_MONTH = 46;
export const ROW_H_MONTH = 40;
// Vista "22 días" (default): columnas bien más anchas — hay lugar de sobra
// para mostrar el horario de retiro/devolución en los bordes de la barra.
export const COL_W_DENSE = 168;
export const ROW_H_DENSE = 60;
/** A partir de esta cantidad de columnas se usa el layout compacto (Mes/90
 *  días) en vez del ancho con horarios — debe ser >= `NEAR_DAYS` (ver
 *  `src/lib/calendar.ts`) para que ese preset siempre quede en modo ancho. */
export const DENSE_MAX_COLUMNS = 22;

// Columna fija de autos: angosta en mobile (últimos 3 de la patente + modelo
// abreviado) y más ancha desde `sm:` (patente completa + modelo). El valor
// móvil se usa como piso conservador para el minWidth del contenido scrolleable.
export const LABEL_W_MOBILE = 80;
export const LABEL_W_CLASS = "w-20 sm:w-[168px]";

// Franja angosta debajo del track de barras reales donde se dibujan los
// presupuestos (borradores, ver src/lib/rental-quotes.ts) — carril propio,
// no comparten posicionamiento con las barras de alquileres reales.
export const QUOTE_TRACK_H = 22;
