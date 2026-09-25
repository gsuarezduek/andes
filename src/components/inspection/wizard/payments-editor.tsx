"use client";

import { useState } from "react";
import { TextField } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { PaymentMethodPicker } from "@/components/cash/payment-method-picker";
import {
  PaymentAmountFields,
  buildPayment,
  emptyPaymentAmount,
  isPaymentAmountReady,
  type PaymentAmountState,
} from "@/components/cash/payment-amount-fields";
import { formatArs, guaranteeTotal, paidTotal, roundMoney, usdPaymentDetail, type RentalPayment } from "@/lib/contract";

type PaymentMethodOption = {
  id: string;
  name: string;
  adjustmentPercent?: number;
  reference?: string;
  requiresNote?: boolean;
  parentId?: string | null;
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
  usdRate = null,
}: {
  payments: RentalPayment[];
  paymentMethods: PaymentMethodOption[];
  onAdd: (payment: RentalPayment) => void;
  onRemove: (index: number) => void;
  totalLabel?: string;
  /** Valor de referencia del USD (Caja) — precarga la cotización de un pago en dólares. */
  usdRate?: number | null;
}) {
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payMethodId, setPayMethodId] = useState("");
  const [payAmount, setPayAmount] = useState<PaymentAmountState>(emptyPaymentAmount(usdRate));
  const [payNote, setPayNote] = useState("");
  const [payIsGuarantee, setPayIsGuarantee] = useState(false);

  // Suma el importe base (lo que cuenta para el saldo) — no lo realmente
  // cobrado (`adjustedAmount`, que cada línea sigue mostrando aparte). Ver
  // el comentario de `RentalPayment` en contract.ts. Una garantía no cuenta
  // para ninguna de las dos: se devuelve, no es plata que paga el alquiler.
  const nonGuaranteePayments = payments.filter((p) => !p.isGuarantee);
  const paid = paidTotal(payments);
  const chargedTotal = nonGuaranteePayments.reduce((a, p) => a + p.adjustedAmount, 0);
  const surcharge = roundMoney(chargedTotal - paid);
  const guaranteeAmount = guaranteeTotal(payments);
  const selectedMethod = paymentMethods.find((m) => m.id === payMethodId);

  function openPayModal() {
    setPayMethodId("");
    setPayAmount(emptyPaymentAmount(usdRate));
    setPayNote("");
    setPayIsGuarantee(false);
    setPayModalOpen(true);
  }
  function confirmPayment() {
    if (!selectedMethod) return;
    const payment = buildPayment(selectedMethod, payAmount, { note: payNote, isGuarantee: payIsGuarantee });
    if (!payment) return;
    onAdd(payment);
    setPayModalOpen(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground/80">{totalLabel}</span>
        <span className="text-sm font-semibold text-foreground">{formatArs(paid)}</span>
      </div>
      {Math.abs(surcharge) > 0.01 && (
        <p className="text-xs text-foreground/50">
          Cobrado realmente: {formatArs(chargedTotal)} — {formatArs(Math.abs(surcharge))}{" "}
          {surcharge > 0 ? "de recargo" : "de descuento"} por medios de pago, no se descuenta del saldo.
        </p>
      )}
      {guaranteeAmount > 0 && (
        <p className="text-xs text-foreground/50">
          Garantías registradas: {formatArs(guaranteeAmount)} — se devuelven, no cuentan como cobro. Se registran
          aparte en Caja → Garantías.
        </p>
      )}
      {payments.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {payments.map((p, i) => (
            <li
              key={i}
              className={`flex flex-col gap-0.5 rounded-lg border px-3 py-2 text-sm ${p.unconfirmed ? "border-amber-500/40 bg-amber-500/5" : "border-foreground/10"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span>
                  {p.methodName}
                  {p.adjustmentPercent ? (
                    <span className="ml-1 text-xs text-foreground/50">
                      ({p.adjustmentPercent > 0 ? "+" : ""}
                      {p.adjustmentPercent}%)
                    </span>
                  ) : null}
                  {p.isGuarantee && (
                    <span className="ml-1.5">
                      <Badge tone="violet">Garantía</Badge>
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-medium">{formatArs(p.adjustedAmount)}</span>
                  <button type="button" onClick={() => onRemove(i)} className="text-xs text-red-600">
                    Quitar
                  </button>
                </span>
              </div>
              {usdPaymentDetail(p) && (
                <span className="text-xs text-foreground/50">Recibido en dólares: {usdPaymentDetail(p)}</span>
              )}
              {p.note && <span className="text-xs text-foreground/50">{p.note}</span>}
              {p.unconfirmed && (
                <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                  Importado de VikRentCar — todavía no se confirmó el medio real (se puede confirmar
                  desde Caja).
                </span>
              )}
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
        <PaymentMethodPicker
          id="wizard_payment_method"
          label="Medio de pago"
          options={paymentMethods}
          value={payMethodId}
          onChange={setPayMethodId}
          placeholder="Buscar medio de pago…"
          formatOption={(m) =>
            `${m.name}${m.adjustmentPercent ? ` (${m.adjustmentPercent > 0 ? "+" : ""}${m.adjustmentPercent}%)` : ""}`
          }
        />
        <div className="mt-3">
          <PaymentAmountFields
            idPrefix="pay"
            value={payAmount}
            onChange={setPayAmount}
            adjustmentPercent={selectedMethod?.adjustmentPercent}
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
        <label className="mt-4 flex items-start gap-2 text-sm text-foreground/70">
          <input
            type="checkbox"
            checked={payIsGuarantee}
            onChange={(e) => setPayIsGuarantee(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-foreground/30"
          />
          <span>
            Es una garantía
            <span className="block text-xs text-foreground/50">
              Se devuelve, no cuenta como cobro del alquiler — se registra aparte en Caja → Garantías.
            </span>
          </span>
        </label>
        <div className="mt-5 flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={() => setPayModalOpen(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={
              !selectedMethod ||
              !isPaymentAmountReady(payAmount) ||
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
