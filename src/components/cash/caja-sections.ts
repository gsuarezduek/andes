/**
 * Secciones de Caja (mismas que las pestañas de `CajaTabs`) — lista única
 * compartida con `CajaSectionNav`, la barra de navegación que se muestra en
 * las páginas de detalle (`/caja/proveedores/[id]`, `/caja/asociados/[id]`,
 * `/caja/saldos/[id]`, `/caja/saldos/caja-fuerte`) para poder saltar
 * directo a otra sección sin pasar primero por `/caja` (que sin esto
 * siempre abre en "Movimientos", perdiendo la pestaña en la que se estaba).
 */
export type CajaSectionKey = "movimientos" | "asociados" | "proveedores" | "garantias" | "saldos";

export const CAJA_SECTIONS: { key: CajaSectionKey; label: string }[] = [
  { key: "movimientos", label: "Movimientos" },
  { key: "asociados", label: "Asociados" },
  { key: "proveedores", label: "Cuentas corrientes" },
  { key: "garantias", label: "Garantías" },
  { key: "saldos", label: "Saldos" },
];
