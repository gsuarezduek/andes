/**
 * Geometría del croquis del auto (vista superior), compartida entre el croquis
 * interactivo en pantalla (`croquis.tsx`, SVG HTML) y el dibujado dentro del
 * acta PDF (`@react-pdf/renderer`, primitivas Svg). Única fuente de verdad para
 * que ambos rendericen exactamente el mismo auto.
 *
 * El viewBox es 0 0 100 190; las posiciones de daño son 0–1 y se escalan a
 * (posX × 100, posY × 190).
 */
export const CROQUIS_VIEWBOX = { width: 100, height: 190 } as const;

export const CROQUIS_BODY = { x: 18, y: 8, width: 64, height: 174, rx: 26 } as const;
export const CROQUIS_ROOF = { x: 30, y: 58, width: 40, height: 80, rx: 12 } as const;
export const CROQUIS_MIRRORS = [
  { x: 12, y: 60, width: 6, height: 10, rx: 2 },
  { x: 82, y: 60, width: 6, height: 10, rx: 2 },
] as const;
export const CROQUIS_WINDSHIELD = "M26 46 Q50 34 74 46";
export const CROQUIS_REAR_WINDOW = "M26 150 Q50 162 74 150";
