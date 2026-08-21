"use client";

import { ToggleButton } from "@/components/ui/toggle-button";
import type { Currency } from "@/lib/currency";

/**
 * Selector de moneda (Pesos/Dólares) para el monto de un movimiento de Caja
 * o Caja fuerte — dos botones mutuamente excluyentes, mismo estilo "chip"
 * que el resto de los toggles del wizard. Lleva su propio input oculto para
 * que el `name` viaje en el FormData del form que lo contiene.
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
      <div className="grid grid-cols-2 gap-2">
        <ToggleButton active={value === "ars"} onClick={() => onChange("ars")}>
          $ Pesos (ARS)
        </ToggleButton>
        <ToggleButton active={value === "usd"} onClick={() => onChange("usd")}>
          US$ Dólares
        </ToggleButton>
      </div>
    </div>
  );
}
