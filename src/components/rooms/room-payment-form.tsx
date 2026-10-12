"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TextField } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import { PaymentMethodPicker, type PaymentMethodPickerOption } from "@/components/cash/payment-method-picker";
import {
  PaymentAmountFields,
  buildPayment,
  emptyPaymentAmount,
  isPaymentAmountReady,
  type PaymentAmountState,
} from "@/components/cash/payment-amount-fields";
import type { Currency } from "@/lib/currency";
import { addRoomPayment } from "@/app/(app)/rooms/actions";

type Method = PaymentMethodPickerOption & { requiresNote: boolean; adjustmentPercent?: number };

/**
 * Registra un cobro de la estadía → ingreso de Caja vinculado a la reserva.
 * Mismo editor de importe que "Agregar pago" de un alquiler de auto
 * (`AddPaymentButton`) — el recargo del medio de pago (ej. +6% con tarjeta)
 * se calcula y se muestra en vivo, no hace falta sumarlo a mano.
 */
export function RoomPaymentForm({
  bookingId,
  paymentMethods,
  defaultCurrency,
  usdRate = null,
}: {
  bookingId: string;
  paymentMethods: Method[];
  defaultCurrency: Currency;
  /** Valor de referencia del USD (Caja) — precarga la cotización de un pago en dólares. */
  usdRate?: number | null;
}) {
  const router = useRouter();
  const [methodId, setMethodId] = useState("");
  const [amount, setAmount] = useState<PaymentAmountState>({ ...emptyPaymentAmount(usdRate), currency: defaultCurrency });
  const [note, setNote] = useState("");
  const [detail, setDetail] = useState("");
  const [error, setError] = useState<string>();
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  const method = paymentMethods.find((m) => m.id === methodId);

  function reset() {
    setMethodId("");
    setAmount({ ...emptyPaymentAmount(usdRate), currency: defaultCurrency });
    setNote("");
    setDetail("");
  }

  function confirm() {
    if (!method) return;
    const payment = buildPayment(method, amount, { note, isGuarantee: false });
    if (!payment) return;
    setError(undefined);
    setOk(false);
    start(async () => {
      try {
        await addRoomPayment(bookingId, payment, detail.trim() || undefined);
        reset();
        setOk(true);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo registrar el cobro.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-4">
      <h3 className="text-sm font-semibold">Registrar un cobro</h3>
      <PaymentMethodPicker
        id="room_payment_method"
        label="Medio de pago"
        hint="Efectivo si lo cobraron en mano; o la cuenta a la que Airbnb/Booking acredita el pago."
        options={paymentMethods}
        value={methodId}
        onChange={(id) => {
          setMethodId(id);
          setOk(false);
        }}
        placeholder="Buscar medio de pago…"
        formatOption={(m) => `${m.name}${m.adjustmentPercent ? ` (${m.adjustmentPercent > 0 ? "+" : ""}${m.adjustmentPercent}%)` : ""}`}
      />
      <PaymentAmountFields
        idPrefix="room_payment"
        value={amount}
        onChange={(next) => {
          setAmount(next);
          setOk(false);
        }}
        adjustmentPercent={method?.adjustmentPercent}
      />
      {method?.requiresNote ? (
        <TextField
          id="room_payment_note"
          label="¿A dónde fue?"
          required
          hint="Obligatorio para este medio de pago"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      ) : null}
      <TextField
        id="room_payment_detail"
        label="Detalle"
        hint="Opcional — ej. «seña», «saldo al llegar»."
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {ok ? <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">Cobro registrado en Caja.</p> : null}
      <Button
        type="button"
        disabled={pending || !method || !isPaymentAmountReady(amount) || (method.requiresNote && !note.trim())}
        onClick={confirm}
      >
        {pending ? "Registrando…" : "Registrar cobro"}
      </Button>
    </div>
  );
}
