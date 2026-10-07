// Única densidad de columna del Calendario (antes había una vista angosta
// de overview y otra ancha con horarios; se unificaron en una sola a pedido
// del dueño — cada barra decide sola qué mostrar según el ancho real que le
// toca, ver `barContentTier` en `calendar-row.tsx`).
export const COL_W_MONTH = 46;
export const ROW_H_MONTH = 40;

// Columna fija de autos: angosta en mobile (últimos 3 de la patente + modelo
// abreviado) y más ancha desde `sm:` (patente completa + modelo). El valor
// móvil se usa como piso conservador para el minWidth del contenido scrolleable.
export const LABEL_W_MOBILE = 80;
export const LABEL_W_CLASS = "w-20 sm:w-[168px]";

// Franja angosta debajo del track de barras reales donde se dibujan los
// presupuestos (borradores, ver src/lib/rental-quotes.ts) — carril propio,
// no comparten posicionamiento con las barras de alquileres reales.
export const QUOTE_TRACK_H = 22;
