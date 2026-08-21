import type { ReactNode } from "react";

/**
 * Etiqueta de un sub-grupo dentro de un bloque más grande (`SectionHeading`)
 * — ej. "Alertas de service" y "Envío de actas" dentro de "Condiciones".
 * Un escalón por debajo de `SectionHeading`, uno por encima de un label de
 * campo suelto.
 */
export function SubsectionTitle({
  children,
  description,
}: {
  children: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-sm font-semibold text-foreground/80">{children}</h3>
      {description ? <p className="text-xs text-foreground/50">{description}</p> : null}
    </div>
  );
}
