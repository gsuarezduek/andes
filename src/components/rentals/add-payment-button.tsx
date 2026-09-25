"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TextField } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { PaymentIcon } from "@/components/ui/icons";
import { PaymentMethodPicker } from "@/components/cash/payment-method-picker";
import {
  PaymentAmountFields,
  buildPayment,
  emptyPaymentAmount,
  isPaymentAmountReady,
  type PaymentAmountState,
} from "@/components/cash/payment-amount-fields";
import { addRentalPayment } from "@/app/(app)/rentals/[id]/payment-actions";

type PaymentMethodOption = {
  id: string;
  name: string;
  adjustmentPercent?: number;
  reference?: string;
  requiresNote?: boolean;
  parentId?: string | null;
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
  usdRate = null,
}: {
  rentalId: string;
  paymentMethods: PaymentMethodOption[];
  /** Valor de referencia del USD (Caja) — precarga la cotización de un pago en dólares. */
  usdRate?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [methodId, setMethodId] = useState("");
  const [amount, setAmount] = useState<PaymentAmountState>(emptyPaymentAmount(usdRate));
  const [note, setNote] = useState("");
  const [isGuarantee, setIsGuarantee] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const router = useRouter();

  const selectedMethod = paymentMethods.find((m) => m.id === methodId);

  function openModal() {
    setMethodId("");
    setAmount(emptyPaymentAmount(usdRate));
    setNote("");
    setIsGuarantee(false);
    setError(undefined);
    setOpen(true);
  }

  function confirm() {
    if (!selectedMethod) return;
    const payment = buildPayment(selectedMethod, amount, { note, isGuarantee });
    if (!payment) return;
    setError(undefined);
    start(async () => {
      try {
        await addRentalPayment(rentalId, payment);
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
          <PaymentAmountFields
            idPrefix="add_payment"
            value={amount}
            onChange={setAmount}
            adjustmentPercent={selectedMethod?.adjustmentPercent}
          />
        </div>
        {selectedMethod?.reference && (
          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-foreground/5 p-2 text-xs text-foreground/70">{selectedMethod.reference}</p>
        )}
        {selectedMethod?.requiresNote && (
          <div className="mt-3">
            <TextField id="add_payment_note" label="¿A dónde fue?" hint="Obligatorio para este medio de pago" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        )}
        <label className="mt-4 flex items-start gap-2 text-sm text-foreground/70">
          <input
            type="checkbox"
            checked={isGuarantee}
            onChange={(e) => setIsGuarantee(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-foreground/30"
          />
          <span>
            Es una garantía
            <span className="block text-xs text-foreground/50">
              Se devuelve, no cuenta como cobro del alquiler — se registra aparte en Caja → Garantías.
            </span>
          </span>
        </label>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-5 flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={pending || !selectedMethod || !isPaymentAmountReady(amount) || (selectedMethod?.requiresNote && !note.trim())}
            onClick={confirm}
          >
            {pending ? "Guardando…" : "Agregar"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
