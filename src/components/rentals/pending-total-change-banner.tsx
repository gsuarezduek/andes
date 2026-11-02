"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TextField } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import { formatArs, roundMoney } from "@/lib/contract";
import { totalDifference } from "@/lib/rental-total-change";
import {
  applyRentalTotalChange,
  dismissRentalTotalChange,
} from "@/app/(app)/rentals/[id]/total-change-actions";

export type PendingTotalChange = {
  id: string;
  previousTotal: number;
  newTotal: number;
};

/**
 * El total de la orden cambió en VikRentCar con el contrato ya cargado (ver
 * `RentalTotalChange`): el saldo sigue saliendo del contrato hasta que alguien
 * decide acá. El importe se puede ajustar porque el contrato puede no coincidir
 * con la web (ej. un precio pactado aparte).
 */
export function PendingTotalChangeBanner({
  change,
  hasExtensions,
}: {
  change: PendingTotalChange;
  hasExtensions: boolean;
}) {
  const difference = totalDifference(change.previousTotal, change.newTotal);
  const raised = difference > 0;

  const [mode, setMode] = useState<"idle" | "apply" | "dismiss">("idle");
  const [amount, setAmount] = useState(String(Math.abs(difference)));
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const router = useRouter();

  const parsedAmount = roundMoney(Number(amount.replace(",", ".")));
  const amountValid = amount.trim() !== "" && Number.isFinite(parsedAmount) && parsedAmount > 0;

  function run(action: () => Promise<{ error?: string }>) {
    setError(undefined);
    start(async () => {
      const res = await action();
      if (res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3">
      <p className="text-sm font-medium text-red-700 dark:text-red-400">
        El total en VikRentCar {raised ? "subió" : "bajó"} {formatArs(Math.abs(difference))} (de{" "}
        {formatArs(change.previousTotal)} a {formatArs(change.newTotal)}). El contrato y el saldo todavía no lo
        incluyen.
      </p>
      {hasExtensions && (
        <p className="mt-1 text-xs text-foreground/70">
          Este alquiler tiene una extensión: si la diferencia es por esos días, ignorá este aviso para no cobrarla dos
          veces.
        </p>
      )}

      {mode === "idle" && (
        <div className="mt-2 flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={() => setMode("dismiss")}>
            Ignorar
          </Button>
          <Button type="button" className="flex-1" onClick={() => setMode("apply")}>
            {raised ? "Sumar al contrato" : "Restar del contrato"}
          </Button>
        </div>
      )}

      {mode === "apply" && (
        <div className="mt-3 flex flex-col gap-2">
          <TextField
            id={`total_change_amount_${change.id}`}
            label={raised ? "Importe a sumar" : "Importe a restar"}
            type="text"
            inputMode="decimal"
            prefix="$"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setMode("idle")}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={pending || !amountValid}
              onClick={() => run(() => applyRentalTotalChange(change.id, { amount: raised ? parsedAmount : -parsedAmount }))}
            >
              {pending ? "Guardando…" : "Confirmar"}
            </Button>
          </div>
        </div>
      )}

      {mode === "dismiss" && (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-xs text-foreground/70">El contrato y el saldo quedan como están.</p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setMode("idle")}>
              Volver
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={pending}
              onClick={() => run(() => dismissRentalTotalChange(change.id))}
            >
              {pending ? "Guardando…" : "Ignorar aviso"}
            </Button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
