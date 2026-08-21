"use client";

import type { Currency } from "@/lib/currency";

/**
 * Switch compacto de moneda (ARS/USD) — pensado para compartir fila con el
 * campo Monto (grid 70/30, ver los forms que lo usan): mismo alto que un
 * input (`h-11`) y mismo estilo de label que TextField/SelectField para que
 * ambos controles queden alineados. Lleva su propio input oculto para que
 * el `name` viaje en el FormData del form que lo contiene.
 */
export function CurrencyToggle({
  value,
  onChange,
  name = "currency",
}: {
  value: Currency;
  onChange: (currency: Currency) => void;
  name?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground/80">Moneda</span>
      <input type="hidden" name={name} value={value} />
      <div className="flex h-11 rounded-lg border border-foreground/15 p-0.5">
        <button
          type="button"
          onClick={() => onChange("ars")}
          aria-pressed={value === "ars"}
          className={`flex-1 rounded-md text-sm font-semibold transition-colors ${
            value === "ars" ? "bg-foreground text-background" : "text-foreground/50"
          }`}
        >
          ARS
        </button>
        <button
          type="button"
          onClick={() => onChange("usd")}
          aria-pressed={value === "usd"}
          className={`flex-1 rounded-md text-sm font-semibold transition-colors ${
            value === "usd" ? "bg-foreground text-background" : "text-foreground/50"
          }`}
        >
          USD
        </button>
      </div>
    </div>
  );
}
