"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { TextField, TextareaField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { CurrencyToggle } from "@/components/cash/currency-toggle";
import { PaymentMethodPicker } from "@/components/cash/payment-method-picker";
import { createAccountTransfer, type TransferResult } from "@/app/(app)/caja/transfer-actions";
import { formatMoney, formatTransferAmount } from "@/lib/contract";
import type { Currency, TransferCurrency } from "@/lib/currency";
import type { TransferAccountOption, TransferBalance } from "@/lib/account-transfers";
import { FixedAccountField } from "@/components/cash/fixed-account-field";

export type { TransferAccountOption };

const round2 = (n: number) => Math.round(n * 100) / 100;
const round8 = (n: number) => Math.round(n * 1e8) / 1e8;

const prefixFor = (c: TransferCurrency) => (c === "usd" ? "US$" : c === "btc" ? "₿" : "$");
const stepFor = (c: TransferCurrency) => (c === "btc" ? "0.00000001" : "0.01");

/**
 * Cuánto entra en `to` por `amount` de `from`, con el valor de referencia del
 * USD (pesos por dólar) y el precio del BTC en dólares. null si falta alguno
 * de los dos datos que hace falta. Solo es una sugerencia: el monto real de
 * la operación es el que se carga.
 */
function suggestToAmount(
  amount: number,
  from: TransferCurrency,
  to: TransferCurrency,
  usdRate: number | null,
  btcUsdPrice: number | null,
): number | null {
  if (!(amount > 0) || from === to) return null;
  const toUsd = (n: number, c: TransferCurrency) =>
    c === "usd" ? n : c === "ars" ? (usdRate ? n / usdRate : null) : btcUsdPrice ? n * btcUsdPrice : null;
  const fromUsd = (n: number, c: TransferCurrency) =>
    c === "usd" ? n : c === "ars" ? (usdRate ? n * usdRate : null) : btcUsdPrice ? n / btcUsdPrice : null;
  const usd = toUsd(amount, from);
  const result = usd == null ? null : fromUsd(usd, to);
  if (result == null) return null;
  return to === "btc" ? round8(result) : round2(result);
}

/**
 * "Mover entre cuentas": traspaso de saldo entre dos cuentas propias — ni
 * ingreso ni egreso. Con la misma moneda entra lo mismo que sale; con
 * "Cambio de moneda" el monto que entra se sugiere con el valor de
 * referencia del USD (editable: la cotización real de la operación es la que
 * queda). Si un lado es una cuenta Bitcoin, ese lado va siempre en BTC y es
 * un cambio de moneda (comprar o vender BTC), con la sugerencia según el
 * precio del día. Avisa —sin bloquear— si el origen quedaría en negativo.
 *
 * Con `fixedAccounts` (página de una cuenta) uno de los dos lados queda fijo
 * en esa cuenta (o una de sus subcuentas) y se elige si la plata sale de ella
 * o entra en ella.
 */
export function TransferLauncher({
  accounts,
  balances,
  usdRate,
  btcUsdPrice = null,
  fixedAccounts,
  buttonClassName,
}: {
  accounts: TransferAccountOption[];
  balances: Record<string, TransferBalance>;
  usdRate: number | null;
  /** Precio de 1 BTC en dólares (ver `getBtcPrice`), para sugerir montos. */
  btcUsdPrice?: number | null;
  fixedAccounts?: TransferAccountOption[];
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="secondary" className={buttonClassName} onClick={() => setOpen(true)}>
        Mover entre cuentas
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Mover entre cuentas" className="max-w-md">
        {open && (
          <TransferForm
            accounts={accounts}
            balances={balances}
            usdRate={usdRate}
            btcUsdPrice={btcUsdPrice}
            fixedAccounts={fixedAccounts}
            onDone={() => setOpen(false)}
          />
        )}
      </Modal>
    </>
  );
}

function TransferForm({
  accounts,
  balances,
  usdRate,
  btcUsdPrice,
  fixedAccounts,
  onDone,
}: {
  accounts: TransferAccountOption[];
  balances: Record<string, TransferBalance>;
  usdRate: number | null;
  btcUsdPrice: number | null;
  fixedAccounts?: TransferAccountOption[];
  onDone: () => void;
}) {
  const [state, formAction] = useActionState<TransferResult, FormData>(createAccountTransfer, {});
  const [fromId, setFromId] = useState(fixedAccounts?.[0]?.id ?? "");
  const [toId, setToId] = useState("");
  // Con cuenta fija: "out" = sale de esta cuenta, "in" = entra en esta cuenta.
  const [direction, setDirection] = useState<"out" | "in">("out");
  // Moneda del lado que no es Bitcoin (pesos o dólares).
  const [currency, setCurrency] = useState<Currency>("ars");
  // Al vender BTC: en qué moneda entra la plata.
  const [receiveCurrency, setReceiveCurrency] = useState<Currency>("usd");
  const [amount, setAmount] = useState("");
  const [exchange, setExchange] = useState(false);
  const [toAmount, setToAmount] = useState("");
  const [toTouched, setToTouched] = useState(false);

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  const from = accounts.find((a) => a.id === fromId);
  const to = accounts.find((a) => a.id === toId);
  const fromIsBtc = !!from?.isBitcoin;
  const toIsBtc = !!to?.isBitcoin;
  const btcMode = fromIsBtc || toIsBtc;

  const fromCurrency: TransferCurrency = fromIsBtc ? "btc" : currency;
  const toCurrency: TransferCurrency = toIsBtc
    ? "btc"
    : fromIsBtc
      ? receiveCurrency
      : exchange
        ? currency === "ars"
          ? "usd"
          : "ars"
        : currency;
  const needsToAmount = fromCurrency !== toCurrency;

  const amountNum = Number(amount);
  const suggestion = needsToAmount ? suggestToAmount(amountNum, fromCurrency, toCurrency, usdRate, btcUsdPrice) : null;
  const shownToAmount = toTouched ? toAmount : suggestion != null ? String(suggestion) : "";

  const fromBalance = from ? balances[from.principalId]?.[fromCurrency] : undefined;
  const overdrawn = fromBalance != null && amountNum > 0 && amountNum > fromBalance;
  const sameAccount = fromId !== "" && fromId === toId && !needsToAmount;
  const canSubmit =
    fromId !== "" && toId !== "" && amountNum > 0 && !sameAccount && (!needsToAmount || Number(shownToAmount) > 0);

  const suggestionHint = (() => {
    if (fromCurrency === "btc" || toCurrency === "btc") {
      if (!btcUsdPrice) return "No se pudo obtener el precio del BTC: cargá el monto de la operación.";
      const viaArs = fromCurrency === "ars" || toCurrency === "ars";
      if (viaArs && !usdRate) return "Todavía no hay un valor de referencia del USD cargado.";
      return `Sugerido con el precio de hoy (1 BTC ≈ ${formatMoney(btcUsdPrice, "usd")}${
        viaArs && usdRate ? ` y el USD a ${formatMoney(usdRate, "ars")}` : ""
      }) — ajustalo al monto real de la operación.`;
    }
    return usdRate
      ? `Sugerido con el valor de referencia (${formatMoney(usdRate, "ars")}) — ajustalo a la cotización real.`
      : "Todavía no hay un valor de referencia del USD cargado.";
  })();

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {fixedAccounts && (
        <div className="flex rounded-lg border border-foreground/15 p-0.5">
          {(
            [
              ["out", "Sale de esta cuenta"],
              ["in", "Entra a esta cuenta"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={direction === value}
              onClick={() => {
                if (value === direction) return;
                // El lado fijo cambia de lugar: se intercambian origen y destino.
                setDirection(value);
                setFromId(toId);
                setToId(fromId);
                setToTouched(false);
              }}
              className={`h-10 flex-1 rounded-md text-sm font-semibold transition-colors ${
                direction === value ? "bg-foreground text-background" : "text-foreground/60"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {fixedAccounts && direction === "out" ? (
        <FixedAccountField id="fromAccountId" label="Sale de" options={fixedAccounts} value={fromId} onChange={setFromId} />
      ) : (
        <PaymentMethodPicker
          id="fromAccountId"
          label="Sale de"
          options={accounts}
          value={fromId}
          onChange={(id) => {
            setFromId(id);
            setToTouched(false);
          }}
          placeholder="Buscar cuenta de origen…"
        />
      )}
      {fixedAccounts && direction === "in" ? (
        <FixedAccountField id="toAccountId" label="Entra en" options={fixedAccounts} value={toId} onChange={setToId} />
      ) : (
        <PaymentMethodPicker
          id="toAccountId"
          label="Entra en"
          options={accounts}
          value={toId}
          onChange={(id) => {
            setToId(id);
            setToTouched(false);
          }}
          placeholder="Buscar cuenta de destino…"
        />
      )}

      <input type="hidden" name="fromCurrency" value={fromCurrency} />
      <input type="hidden" name="toCurrency" value={toCurrency} />
      <div className={fromIsBtc ? "" : "grid grid-cols-[7fr_3fr] gap-2"}>
        <TextField
          id="fromAmount"
          label={fromIsBtc ? "BTC que salen" : "Monto"}
          type="number"
          step={stepFor(fromCurrency)}
          min="0"
          prefix={prefixFor(fromCurrency)}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        {!fromIsBtc && <CurrencyToggle value={currency} onChange={setCurrency} />}
      </div>
      {overdrawn && from && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          Ojo: {from.name} tiene {formatTransferAmount(fromBalance!, fromCurrency)} — este traspaso la deja en negativo.
          Podés registrarlo igual.
        </p>
      )}

      {btcMode ? (
        fromIsBtc &&
        !toIsBtc && (
          // Su propia etiqueta ("Moneda") ya alcanza: queda justo arriba de "Monto que entra".
          <CurrencyToggle
            value={receiveCurrency}
            name="receiveCurrency"
            onChange={(c) => {
              setReceiveCurrency(c);
              setToTouched(false);
            }}
          />
        )
      ) : (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={exchange}
            onChange={(e) => {
              setExchange(e.target.checked);
              setToTouched(false);
            }}
          />
          Es un cambio de moneda (ARS ↔ USD)
        </label>
      )}
      {needsToAmount && (
        <TextField
          id="toAmount"
          label={toCurrency === "btc" ? "BTC que entran" : `Monto que entra (${toCurrency.toUpperCase()})`}
          type="number"
          step={stepFor(toCurrency)}
          min="0"
          prefix={prefixFor(toCurrency)}
          value={shownToAmount}
          onChange={(e) => {
            setToAmount(e.target.value);
            setToTouched(true);
          }}
          hint={suggestionHint}
          required
        />
      )}

      <TextareaField id="description" label="Detalle" hint="Opcional" rows={2} />

      {(state.error || sameAccount) && (
        <p className="text-sm text-red-600">{state.error ?? "El origen y el destino son la misma cuenta."}</p>
      )}
      <div className="flex items-center gap-3">
        <button type="button" onClick={onDone} className="text-xs text-foreground/50">
          Cancelar
        </button>
        <SubmitButton pendingLabel="Guardando…" className="ml-auto" disabled={!canSubmit}>
          Mover
        </SubmitButton>
      </div>
    </form>
  );
}
