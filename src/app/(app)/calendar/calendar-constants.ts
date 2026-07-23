// Vista Mes: columnas angostas, sólo se ve qué días están ocupados.
export const COL_W_MONTH = 46;
export const ROW_H_MONTH = 40;
// Vista Semana: columnas bien más anchas — no es "el mismo mes recortado",
// hay lugar de sobra para mostrar el horario de retiro/devolución en la barra.
export const COL_W_WEEK = 168;
export const ROW_H_WEEK = 60;
/** A partir de esta cantidad de columnas se usa el layout compacto de Mes. */
export const WEEK_MAX_COLUMNS = 7;

// Columna fija de autos: angosta en mobile (sólo los últimos 3 de la patente,
// sin modelo) y más ancha desde `sm:` (patente completa + modelo). El valor
// móvil se usa como piso conservador para el minWidth del contenido scrolleable.
export const LABEL_W_MOBILE = 64;
export const LABEL_W_CLASS = "w-16 sm:w-[168px]";
