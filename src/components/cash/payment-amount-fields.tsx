"use client";

import { TextField } from "@/components/ui/fields";
import { CurrencyToggle } from "@/components/cash/currency-toggle";
import {
  formatMoney,
  paymentAdjustedAmount,
  usdPaymentAmounts,
  type RentalPayment,
} from "@/lib/contract";
import type { Currency } from "@/lib/currency";
import { parseDecimal } from "@/lib/number-input";

export type PaymentAmountState = { currency: Currency; amount: string; rate: string };

type MethodForPayment = {
  id: string;
  name: string;
  adjustmentPercent?: number;
  requiresNote?: boolean;
};

/** Estado inicial: pesos, sin importe, con la cotización de referencia ya cargada. */
export function emptyPaymentAmount(usdRate: number | null): PaymentAmountState {
  return { currency: "ars", amount: "", rate: usdRate != null ? String(usdRate) : "" };
}

/** ¿Hay un importe (y, en dólares, una cotización) válido para confirmar? */
export function isPaymentAmountReady(state: PaymentAmountState): boolean {
  const amount = parseDecimal(state.amount) ?? 0;
  if (amount <= 0) return false;
  if (state.currency === "usd") return (parseDecimal(state.rate) ?? 0) > 0;
  return true;
}

/**
 * Arma la línea de pago (`RentalPayment`) a partir del medio elegido y lo
 * tipeado. En dólares, `amount`/`adjustedAmount` quedan en el equivalente en
 * pesos a la cotización pactada (así saldo y "Paga" no cambian) y se guardan
 * `usdAmount`/`exchangeRate`. `null` si todavía no está completo.
 */
export function buildPayment(
  method: MethodForPayment,
  state: PaymentAmountState,
  opts: { note: string; isGuarantee: boolean },
): RentalPayment | null {
  if (!isPaymentAmountReady(state)) return null;
  if (method.requiresNote && !opts.note.trim()) return null;
  const amount = parseDecimal(state.amount) ?? 0;
  const base = {
    methodId: method.id,
    methodName: method.name,
    adjustmentPercent: method.adjustmentPercent,
    note: method.requiresNote ? opts.note.trim() : undefined,
    isGuarantee: opts.isGuarantee || undefined,
  };
  if (state.currency === "usd") {
    const rate = parseDecimal(state.rate) ?? 0;
    const usd = usdPaymentAmounts(amount, rate, method.adjustmentPercent);
    return { ...base, amount: usd.amount, adjustedAmount: usd.adjustedAmount, usdAmount: amount, exchangeRate: rate };
  }
  return { ...base, amount, adjustedAmount: paymentAdjustedAmount(amount, method.adjustmentPercent) };
}

/**
 * Importe del pago en pesos o en dólares (con la cotización), compartido por
 * "Agregar pago" de la entrega/devolución y del detalle de la reserva.
 */
export function PaymentAmountFields({
  idPrefix,
  value,
  onChange,
  adjustmentPercent,
}: {
  idPrefix: string;
  value: PaymentAmountState;
  onChange: (next: PaymentAmountState) => void;
  adjustmentPercent?: number;
}) {
  const isUsd = value.currency === "usd";
  const amount = parseDecimal(value.amount) ?? 0;
  const rate = parseDecimal(value.rate) ?? 0;
  const usd = isUsd && amount > 0 && rate > 0 ? usdPaymentAmounts(amount, rate, adjustmentPercent) : null;
  const charged = isUsd ? null : paymentAdjustedAmount(amount, adjustmentPercent);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[7fr_3fr] gap-2">
        <TextField
          id={`${idPrefix}_amount`}
          label={isUsd ? "Importe en dólares" : "Importe"}
          type="text"
          inputMode="decimal"
          prefix={isUsd ? "US$" : "$"}
          className={isUsd ? "pl-12!" : ""}
          value={value.amount}
          onChange={(e) => onChange({ ...value, amount: e.target.value })}
        />
        <CurrencyToggle
          name={`${idPrefix}_currency`}
          value={value.currency}
          onChange={(currency) => onChange({ ...value, currency })}
        />
      </div>
      {isUsd && (
        <TextField
          id={`${idPrefix}_rate`}
          label="Cotización (pesos por dólar)"
          hint="Viene precargada con el valor de referencia de Caja — corregila si acordaron otra."
          type="text"
          inputMode="decimal"
          prefix="$"
          value={value.rate}
          onChange={(e) => onChange({ ...value, rate: e.target.value })}
        />
      )}
      <p className="text-sm text-foreground/70">
        {isUsd ? (
          <>
            Equivale a:{" "}
            <span className="font-semibold text-foreground">{usd ? formatMoney(usd.adjustedAmount, "ars") : "—"}</span>
            {usd && (
              <span className="ml-1 text-xs text-foreground/50">
                ({formatMoney(amount, "usd")} × {formatMoney(rate, "ars")}
                {adjustmentPercent ? `, ${adjustmentPercent > 0 ? "+" : ""}${adjustmentPercent}% aplicado` : ""})
              </span>
            )}
          </>
        ) : (
          <>
            Se cobra: <span className="font-semibold text-foreground">{formatMoney(charged, "ars")}</span>
            {adjustmentPercent ? (
              <span className="ml-1 text-xs text-foreground/50">
                ({adjustmentPercent > 0 ? "+" : ""}
                {adjustmentPercent}% aplicado)
              </span>
            ) : null}
          </>
        )}
      </p>
    </div>
  );
}
