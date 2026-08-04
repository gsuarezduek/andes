"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField, TextareaField } from "@/components/ui/fields";
import { createSafeMovement } from "@/app/(app)/caja/safe-actions";

/** Formulario de alta de un movimiento de caja fuerte. A diferencia de
 *  Cobro/Pago, un solo botón ("Caja fuerte") abre este form, que elige el
 *  tipo (ingreso/retiro) por dentro con un selector de dos opciones. */
export function SafeMovementForm({ onCancel }: { onCancel: () => void }) {
  const [type, setType] = useState<"deposit" | "withdrawal">("deposit");

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
      <TextField id="amount" label="Monto" type="number" step="0.01" min="0" prefix="$" required />

      <SubmitButton pendingLabel="Guardando…">
        {type === "deposit" ? "Registrar ingreso" : "Registrar retiro"}
      </SubmitButton>
    </form>
  );
}
