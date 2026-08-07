/**
 * Navegación por pestañas dentro de un paso del wizard ("Condiciones",
 * "Comparación") para partirlo en secciones más chicas — evita un solo
 * scroll larguísimo con muchos campos en 375px. Salto libre (sin
 * validación): son solo agrupaciones visuales del mismo formulario, todo se
 * sigue guardando junto al terminar el paso.
 */
export function SubStepTabs({
  sections,
  active,
  onChange,
}: {
  sections: string[];
  active: number;
  onChange: (i: number) => void;
}) {
  return (
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {sections.map((label, i) => (
        <button
          key={label}
          type="button"
          onClick={() => onChange(i)}
          aria-current={i === active ? "step" : undefined}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            i === active
              ? "bg-foreground text-background"
              : "border border-foreground/15 text-foreground/60 hover:border-foreground/30"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Link "Siguiente sección →" al pie de cada sección (excepto la última). */
export function NextSectionLink({ onClick, label = "Siguiente sección" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} className="self-end text-sm font-medium text-foreground/70 underline">
      {label} →
    </button>
  );
}
