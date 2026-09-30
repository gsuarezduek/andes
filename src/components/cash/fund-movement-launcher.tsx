"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { TextField, TextareaField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { CurrencyToggle } from "@/components/cash/currency-toggle";
import { createFundMovement, type FundMovementResult } from "@/app/(app)/caja/fund-actions";
import type { Currency } from "@/lib/currency";

type FundMovementType = "deposit" | "withdrawal";

/**
 * "+ Depositar a fondos" / "+ Retirar de fondos": dos botones que abren el
 * mismo formulario (modal), parametrizado por tipo. Puramente informativo —
 * no mueve saldo de Caja (ver `createFundMovement`).
 */
export function FundMovementLauncher({ paymentMethodId }: { paymentMethodId: string }) {
  const [open, setOpen] = useState<FundMovementType | null>(null);
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" onClick={() => setOpen("deposit")}>
          + Depositar a fondos
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen("withdrawal")}>
          + Retirar de fondos
        </Button>
      </div>
      <Modal
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open === "deposit" ? "Depositar a fondos" : "Retirar de fondos"}
        className="max-w-md"
      >
        {open && <FundMovementForm paymentMethodId={paymentMethodId} type={open} onDone={() => setOpen(null)} />}
      </Modal>
    </>
  );
}

function FundMovementForm({
  paymentMethodId,
  type,
  onDone,
}: {
  paymentMethodId: string;
  type: FundMovementType;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState<FundMovementResult, FormData>(createFundMovement, {});
  const [currency, setCurrency] = useState<Currency>("ars");

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="paymentMethodId" value={paymentMethodId} />
      <input type="hidden" name="type" value={type} />
      <div className="grid grid-cols-[7fr_3fr] gap-2">
        <TextField
          id="amount"
          label="Monto"
          type="number"
          step="0.01"
          min="0"
          prefix={currency === "usd" ? "US$" : "$"}
          required
        />
        <CurrencyToggle value={currency} onChange={setCurrency} name="currency" />
      </div>
      <TextareaField id="note" label="Nota" hint="Opcional" rows={2} />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex items-center gap-3">
        <button type="button" onClick={onDone} className="text-xs text-foreground/50">
          Cancelar
        </button>
        <SubmitButton pendingLabel="Guardando…" className="ml-auto">
          {type === "deposit" ? "Depositar" : "Retirar"}
        </SubmitButton>
      </div>
    </form>
  );
}
