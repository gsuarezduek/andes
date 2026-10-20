"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TextField } from "@/components/ui/fields";
import { formatMoney } from "@/lib/contract";
import { parseDecimal } from "@/lib/number-input";
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
  bookingCurrency,
  usdRate = null,
}: {
  bookingId: string;
  paymentMethods: Method[];
  /** Moneda del total de la estadía — precarga la del cobro. */
  bookingCurrency: Currency;
  /** Valor de referencia del USD (Caja) — precarga la cotización de un pago en dólares. */
  usdRate?: number | null;
}) {
  const router = useRouter();
  const [methodId, setMethodId] = useState("");
  const [amount, setAmount] = useState<PaymentAmountState>({ ...emptyPaymentAmount(usdRate), currency: bookingCurrency });
  // Estadía en dólares cobrada en pesos: cotización para saber cuántos dólares salda.
  const [crossRate, setCrossRate] = useState(usdRate != null ? String(usdRate) : "");
  const [note, setNote] = useState("");
  const [detail, setDetail] = useState("");
  const [error, setError] = useState<string>();
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  const method = paymentMethods.find((m) => m.id === methodId);
  const pesosForUsdStay = bookingCurrency === "usd" && amount.currency === "ars";
  const crossRateValue = parseDecimal(crossRate) ?? 0;
  const pesosValue = parseDecimal(amount.amount) ?? 0;

  function reset() {
    setMethodId("");
    setAmount({ ...emptyPaymentAmount(usdRate), currency: bookingCurrency });
    setCrossRate(usdRate != null ? String(usdRate) : "");
    setNote("");
    setDetail("");
  }

  function confirm() {
    if (!method) return;
    const built = buildPayment(method, amount, { note, isGuarantee: false });
    if (!built) return;
    if (pesosForUsdStay && crossRateValue <= 0) return;
    const payment = pesosForUsdStay ? { ...built, exchangeRate: crossRateValue } : built;
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
      {pesosForUsdStay ? (
        <>
          <TextField
            id="room_payment_cross_rate"
            label="Cotización del dólar (pesos por dólar)"
            hint="La estadía está en dólares: con esto se calcula cuánto descuenta del saldo. Viene con el valor de referencia de Caja — corregila si acordaron otra."
            type="text"
            inputMode="decimal"
            prefix="$"
            value={crossRate}
            onChange={(e) => {
              setCrossRate(e.target.value);
              setOk(false);
            }}
          />
          <p className="text-sm text-foreground/70">
            Salda:{" "}
            <span className="font-semibold text-foreground">
              {pesosValue > 0 && crossRateValue > 0 ? formatMoney(pesosValue / crossRateValue, "usd") : "—"}
            </span>
          </p>
        </>
      ) : null}
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
        disabled={
          pending ||
          !method ||
          !isPaymentAmountReady(amount) ||
          (method.requiresNote && !note.trim()) ||
          (pesosForUsdStay && crossRateValue <= 0)
        }
        onClick={confirm}
      >
        {pending ? "Registrando…" : "Registrar cobro"}
      </Button>
    </div>
  );
}
