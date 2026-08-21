"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField, TextareaField } from "@/components/ui/fields";
import { CurrencyToggle } from "@/components/cash/currency-toggle";
import { createSafeMovement } from "@/app/(app)/caja/safe-actions";
import type { Currency } from "@/lib/currency";

/** Formulario de alta de un movimiento de caja fuerte. A diferencia de
 *  Ingreso/Egreso, un solo botón ("Caja fuerte") abre este form, que elige el
 *  tipo (ingreso/retiro) por dentro con un selector de dos opciones. */
export function SafeMovementForm({ onCancel }: { onCancel: () => void }) {
  const [type, setType] = useState<"deposit" | "withdrawal">("deposit");
  const [currency, setCurrency] = useState<Currency>("ars");

  return (
    <form
      action={createSafeMovement.bind(null, type)}
      className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Movimiento de caja fuerte</h2>
        <button type="button" onClick={onCancel} className="text-xs text-foreground/50">
          Cancelar
        </button>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setType("deposit")}
          aria-pressed={type === "deposit"}
          className={`h-10 flex-1 rounded-lg text-sm font-medium transition-colors ${
            type === "deposit"
              ? "bg-emerald-600 text-white"
              : "border border-foreground/15 text-foreground/70 hover:bg-foreground/5"
          }`}
        >
          Ingreso
        </button>
        <button
          type="button"
          onClick={() => setType("withdrawal")}
          aria-pressed={type === "withdrawal"}
          className={`h-10 flex-1 rounded-lg text-sm font-medium transition-colors ${
            type === "withdrawal"
              ? "bg-red-600 text-white"
              : "border border-foreground/15 text-foreground/70 hover:bg-foreground/5"
          }`}
        >
          Retiro
        </button>
      </div>

      <TextareaField
        id="description"
        label="Motivo"
        required
        rows={2}
        placeholder={type === "deposit" ? "Ej: recaudación del día" : "Ej: pago de sueldos"}
      />
      <div className="grid grid-cols-[7fr_3fr] gap-2">
        <TextField id="amount" label="Monto" type="number" step="0.01" min="0" prefix="$" required />
        <CurrencyToggle value={currency} onChange={setCurrency} />
      </div>

      <SubmitButton pendingLabel="Guardando…">
        {type === "deposit" ? "Registrar ingreso" : "Registrar retiro"}
      </SubmitButton>
    </form>
  );
}
