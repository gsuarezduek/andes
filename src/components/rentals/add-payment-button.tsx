"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TextField } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { PaymentIcon } from "@/components/ui/icons";
import { PaymentMethodPicker } from "@/components/cash/payment-method-picker";
import { formatArs, paymentAdjustedAmount } from "@/lib/contract";
import { parseDecimal } from "@/lib/number-input";
import { addRentalPayment } from "@/app/(app)/rentals/[id]/payment-actions";

type PaymentMethodOption = {
  id: string;
  name: string;
  adjustmentPercent?: number;
  reference?: string;
  requiresNote?: boolean;
};

/**
 * Botón-ícono en el header de la reserva para cargar un pago suelto (ej. la
 * seña, cuando el cliente pasa a dejarla antes de retirar el auto) sin tener
 * que iniciar la entrega. Mismo editor de medio de pago que la entrega;
 * guarda de una (no acumula una lista local) y queda tanto en el historial
 * de esta reserva como en Caja.
 */
export function AddPaymentButton({
  rentalId,
  paymentMethods,
}: {
  rentalId: string;
  paymentMethods: PaymentMethodOption[];
}) {
  const [open, setOpen] = useState(false);
  const [methodId, setMethodId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const router = useRouter();

  const selectedMethod = paymentMethods.find((m) => m.id === methodId);

  function openModal() {
    setMethodId("");
    setAmount("");
    setNote("");
    setError(undefined);
    setOpen(true);
  }

  function confirm() {
    const method = selectedMethod;
    const amt = parseDecimal(amount) ?? 0;
    if (!method || amt <= 0) return;
    if (method.requiresNote && !note.trim()) return;
    setError(undefined);
    start(async () => {
      try {
        await addRentalPayment(rentalId, {
          methodId: method.id,
          methodName: method.name,
          adjustmentPercent: method.adjustmentPercent,
          amount: amt,
          adjustedAmount: paymentAdjustedAmount(amt, method.adjustmentPercent),
          note: method.requiresNote ? note.trim() : undefined,
        });
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo guardar el pago.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        title="Agregar pago"
        aria-label="Agregar pago"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
      >
        <PaymentIcon />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Agregar pago">
        <PaymentMethodPicker
          id="add_payment_method"
          label="Medio de pago"
          options={paymentMethods}
          value={methodId}
          onChange={setMethodId}
          placeholder="Buscar medio de pago…"
          formatOption={(m) =>
            `${m.name}${m.adjustmentPercent ? ` (${m.adjustmentPercent > 0 ? "+" : ""}${m.adjustmentPercent}%)` : ""}`
          }
        />
        <div className="mt-3">
          <TextField id="add_payment_amount" label="Importe" type="text" inputMode="decimal" prefix="$" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        {selectedMethod?.reference && (
          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-foreground/5 p-2 text-xs text-foreground/70">{selectedMethod.reference}</p>
        )}
        {selectedMethod?.requiresNote && (
          <div className="mt-3">
            <TextField id="add_payment_note" label="¿A dónde fue?" hint="Obligatorio para este medio de pago" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        )}
        {selectedMethod && (
          <p className="mt-3 text-sm text-foreground/70">
            Se cobra: <span className="font-semibold text-foreground">{formatArs(paymentAdjustedAmount(parseDecimal(amount) ?? 0, selectedMethod.adjustmentPercent))}</span>
          </p>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-5 flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={pending || !selectedMethod || !((parseDecimal(amount) ?? 0) > 0) || (selectedMethod?.requiresNote && !note.trim())}
            onClick={confirm}
          >
            {pending ? "Guardando…" : "Agregar"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
