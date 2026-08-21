import type { ReactNode } from "react";

/**
 * Encabezado de un bloque de contenido con entidad propia dentro de una
 * página (ej. "Condiciones", "Checklist", cada sección de Reportes) —
 * más peso que `SubsectionTitle` (sub-grupo dentro de un bloque) y que
 * `SectionTitle` (etiqueta chica sobre un listado tipo dashboard).
 */
export function SectionHeading({
  children,
  description,
}: {
  children: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold">{children}</h2>
      {description ? <p className="text-sm text-foreground/60">{description}</p> : null}
    </div>
  );
}
