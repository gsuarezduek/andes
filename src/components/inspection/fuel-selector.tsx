"use client";

/**
 * Selector visual de nivel de nafta en líneas/octavos (0..max). El máximo
 * depende del vehículo (`Vehicle.fuelLevels`, 4–16; default 8).
 */
export function FuelSelector({
  value,
  onChange,
  max = 8,
}: {
  value: number;
  onChange: (v: number) => void;
  max?: number;
}) {
  const step = 24 / max; // altura de las barras, para que el rango llene el alto
  return (
    <div className="flex flex-col gap-2">
      {/* Autos con muchas líneas (hasta 16) no entran en 44px de ancho cada
          una en una pantalla de celular — en vez de achicarlas por debajo del
          target táctil mínimo, la fila scrollea horizontalmente y cada botón
          nunca baja de 44px (shrink-0), aunque la barra visual adentro sea
          más angosta. Con pocas líneas (el caso común) no hace falta scroll. */}
      <div className="flex items-end gap-1 overflow-x-auto pb-1">
        {Array.from({ length: max + 1 }, (_, i) => {
          const active = i <= value;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange(i)}
              aria-label={`${i}/${max}`}
              aria-pressed={i === value}
              className="flex h-11 shrink-0 grow basis-11 items-end justify-center"
            >
              <span
                className={`w-full rounded-md border transition-colors ${
                  i === value
                    ? "border-foreground ring-2 ring-foreground"
                    : "border-foreground/20"
                } ${active ? "bg-foreground/70" : "bg-transparent"}`}
                style={{ height: `${16 + i * step}px` }}
              />
            </button>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-foreground/60">
        <span>Vacío</span>
        <span className="font-semibold text-foreground">
          {value}/{max}
        </span>
        <span>Lleno</span>
      </div>
    </div>
  );
}
