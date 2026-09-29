"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TextField, TextareaField } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/datetime";
import { completeExtensionCharge } from "@/app/(app)/rentals/[id]/extension-actions";

export type PendingExtension = {
  id: string;
  newEndAt: Date;
  extraDays: number;
};

/**
 * Una extensión detectada por el sync (el cliente ya extendió en VikRentCar):
 * la fecha ya se trajo sola, pero el cargo queda pendiente hasta que alguien
 * lo completa acá — sin esto, el saldo/semáforo de pago queda mal hasta que
 * alguien se acuerde de cargarlo a mano.
 */
export function PendingExtensionBanner({ extension }: { extension: PendingExtension }) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const router = useRouter();

  const parsedAmount = Number(amount.replace(",", "."));
  const amountValid = amount.trim() !== "" && Number.isFinite(parsedAmount) && parsedAmount > 0;

  function confirm() {
    if (!amountValid) return;
    setError(undefined);
    start(async () => {
      const res = await completeExtensionCharge(extension.id, { amount: parsedAmount, note: note.trim() || undefined });
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
        Se extendió {extension.extraDays} día{extension.extraDays === 1 ? "" : "s"} en VikRentCar (ahora vuelve el{" "}
        {formatDate(extension.newEndAt)}) — falta cargar el cobro.
      </p>
      {!editing ? (
        <Button type="button" variant="secondary" className="mt-2" onClick={() => setEditing(true)}>
          Cargar cobro
        </Button>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          <TextField
            id={`extension_charge_${extension.id}`}
            label="Importe"
            type="text"
            inputMode="decimal"
            prefix="$"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <TextareaField
            id={`extension_note_${extension.id}`}
            label="Nota"
            hint="Opcional"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {error && <p className="text-xs font-medium text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
            <Button type="button" className="flex-1" disabled={pending || !amountValid} onClick={confirm}>
              {pending ? "Guardando…" : "Confirmar"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
