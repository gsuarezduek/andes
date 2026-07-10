"use client";

/** Selector visual de nivel de nafta en octavos (0/8 a 8/8). */
export function FuelSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-1">
        {Array.from({ length: 9 }, (_, i) => {
          const active = i <= value;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange(i)}
              aria-label={`${i}/8`}
              aria-pressed={i === value}
              className={`flex-1 rounded-md border transition-colors ${
                i === value
                  ? "border-foreground ring-2 ring-foreground"
                  : "border-foreground/20"
              } ${active ? "bg-foreground/70" : "bg-transparent"}`}
              style={{ height: `${16 + i * 4}px` }}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-foreground/60">
        <span>Vacío</span>
        <span className="font-semibold text-foreground">{value}/8</span>
        <span>Lleno</span>
      </div>
    </div>
  );
}
