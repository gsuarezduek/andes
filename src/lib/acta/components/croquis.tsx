import { Svg, Rect, Path, Circle } from "@react-pdf/renderer";
import {
  CROQUIS_VIEWBOX,
  CROQUIS_BODY,
  CROQUIS_ROOF,
  CROQUIS_MIRRORS,
  CROQUIS_WINDSHIELD,
  CROQUIS_REAR_WINDOW,
} from "@/components/inspection/croquis-shape";
import type { ActaDamage } from "../types";

/**
 * Croquis del auto (vista superior) dibujado con primitivas de react-pdf, con
 * un círculo rojo por cada daño de esta inspección. Misma geometría que el
 * croquis en pantalla (`croquis-shape.ts`).
 */
export function ActaCroquis({ damages }: { damages: ActaDamage[] }) {
  const W = 90;
  const H = (W * CROQUIS_VIEWBOX.height) / CROQUIS_VIEWBOX.width;
  const marks = damages.filter((d) => d.posX != null && d.posY != null);
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${CROQUIS_VIEWBOX.width} ${CROQUIS_VIEWBOX.height}`}>
      <Rect {...CROQUIS_BODY} fill="none" stroke="#94a3b8" strokeWidth={1.5} />
      <Path d={CROQUIS_WINDSHIELD} fill="none" stroke="#cbd5e1" strokeWidth={1.2} />
      <Path d={CROQUIS_REAR_WINDOW} fill="none" stroke="#cbd5e1" strokeWidth={1.2} />
      <Rect {...CROQUIS_ROOF} fill="none" stroke="#e2e8f0" strokeWidth={1} />
      {CROQUIS_MIRRORS.map((m, i) => (
        <Rect key={i} {...m} fill="#e2e8f0" />
      ))}
      {marks.map((d, i) => (
        <Circle key={i} cx={d.posX! * 100} cy={d.posY! * 190} r={4} fill="#dc2626" stroke="#ffffff" strokeWidth={1} />
      ))}
    </Svg>
  );
}
