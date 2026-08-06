"use client";

import { useState } from "react";
import { TextField } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatArs, paymentAdjustedAmount, type RentalPayment } from "@/lib/contract";
import { parseDecimal } from "@/lib/number-input";

type PaymentMethodOption = {
  id: string;
  name: string;
  adjustmentPercent?: number;
  reference?: string;
  requiresNote?: boolean;
};

/**
 * Lista de pagos + botón "Agregar pago" + modal (medio de pago real, con %
 * de ajuste y nota obligatoria si el medio lo requiere). Compartido entre el
 * paso "Condiciones" de la entrega y "Comparación" de la devolución — cada
 * uno decide, vía `onAdd`/`onRemove`, qué más hay que actualizar además del
 * array de pagos (en la entrega, el recargo ajusta el Total a pagar).
 */
export function PaymentsEditor({
  payments,
  paymentMethods,
  onAdd,
  onRemove,
  totalLabel = "Paga",
}: {
  payments: RentalPayment[];
  paymentMethods: PaymentMethodOption[];
  onAdd: (payment: RentalPayment) => void;
  onRemove: (index: number) => void;
  totalLabel?: string;
}) {
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payMethodId, setPayMethodId] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");

  const paidTotal = payments.reduce((a, p) => a + p.adjustedAmount, 0);
  const selectedMethod = paymentMethods.find((m) => m.id === payMethodId);

  function openPayModal() {
    setPayMethodId("");
    setPayAmount("");
    setPayNote("");
    setPayModalOpen(true);
  }
  function confirmPayment() {
    const method = selectedMethod;
    const amount = parseDecimal(payAmount) ?? 0;
    if (!method || amount <= 0) return;
    if (method.requiresNote && !payNote.trim()) return;
    const adjustedAmount = paymentAdjustedAmount(amount, method.adjustmentPercent);
    onAdd({
      methodId: method.id,
      methodName: method.name,
      adjustmentPercent: method.adjustmentPercent,
      amount,
      adjustedAmount,
      note: method.requiresNote ? payNote.trim() : undefined,
    });
    setPayModalOpen(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground/80">{totalLabel}</span>
        <span className="text-sm font-semibold text-foreground">{formatArs(paidTotal)}</span>
      </div>
      {payments.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {payments.map((p, i) => (
            <li key={i} className="flex flex-col gap-0.5 rounded-lg border border-foreground/10 px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span>
                  {p.methodName}
                  {p.adjustmentPercent ? (
                    <span className="ml-1 text-xs text-foreground/50">
                      ({p.adjustmentPercent > 0 ? "+" : ""}
                      {p.adjustmentPercent}%)
                    </span>
                  ) : null}
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-medium">{formatArs(p.adjustedAmount)}</span>
                  <button type="button" onClick={() => onRemove(i)} className="text-xs text-red-600">
                    Quitar
                  </button>
                </span>
              </div>
              {p.note && <span className="text-xs text-foreground/50">{p.note}</span>}
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={openPayModal}
        className="rounded-lg border border-foreground/25 px-3 py-2.5 text-sm font-medium text-foreground/70 transition-colors hover:bg-foreground/5"
      >
        + Agregar pago
      </button>

      <Modal open={payModalOpen} onClose={() => setPayModalOpen(false)} title="Agregar pago">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground/80">Medio de pago</span>
          <select
            value={payMethodId}
            onChange={(e) => setPayMethodId(e.target.value)}
            className="h-11 rounded-lg border border-foreground/15 bg-transparent px-3 text-base outline-none focus:border-foreground/40"
          >
            <option value="">Elegir…</option>
            {paymentMethods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.adjustmentPercent ? ` (${m.adjustmentPercent > 0 ? "+" : ""}${m.adjustmentPercent}%)` : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-3">
          <TextField
            id="pay_amount"
            label="Importe"
            type="text"
            inputMode="decimal"
            prefix="$"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
          />
        </div>
        {selectedMethod?.reference && (
          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-foreground/5 p-2 text-xs text-foreground/70">
            {selectedMethod.reference}
          </p>
        )}
        {selectedMethod?.requiresNote && (
          <div className="mt-3">
            <TextField
              id="pay_note"
              label="¿A dónde fue?"
              hint="Obligatorio para este medio de pago"
              value={payNote}
              onChange={(e) => setPayNote(e.target.value)}
            />
          </div>
        )}
        {selectedMethod && (
          <p className="mt-3 text-sm text-foreground/70">
            Se cobra:{" "}
            <span className="font-semibold text-foreground">
              {formatArs(paymentAdjustedAmount(parseDecimal(payAmount) ?? 0, selectedMethod.adjustmentPercent))}
            </span>
            {selectedMethod.adjustmentPercent ? (
              <span className="ml-1 text-xs text-foreground/50">
                ({selectedMethod.adjustmentPercent > 0 ? "+" : ""}
                {selectedMethod.adjustmentPercent}% aplicado)
              </span>
            ) : null}
          </p>
        )}
        <div className="mt-5 flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={() => setPayModalOpen(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={
              !selectedMethod ||
              !((parseDecimal(payAmount) ?? 0) > 0) ||
              (selectedMethod.requiresNote && !payNote.trim())
            }
            onClick={confirmPayment}
          >
            Agregar
          </Button>
        </div>
      </Modal>
    </div>
  );
}
