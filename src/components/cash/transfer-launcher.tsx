"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { TextField, TextareaField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { CurrencyToggle } from "@/components/cash/currency-toggle";
import { PaymentMethodPicker } from "@/components/cash/payment-method-picker";
import { createAccountTransfer, type TransferResult } from "@/app/(app)/caja/transfer-actions";
import { formatMoney } from "@/lib/contract";
import type { Currency, CurrencyTotals } from "@/lib/currency";
import type { TransferAccountOption } from "@/lib/account-transfers";
import { FixedAccountField } from "@/components/cash/fixed-account-field";

export type { TransferAccountOption };

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * "Mover entre cuentas": traspaso de saldo entre dos cuentas propias — ni
 * ingreso ni egreso. Con la misma moneda entra lo mismo que sale; con
 * "Cambio de moneda" el monto que entra se sugiere con el valor de
 * referencia del USD (editable: la cotización real de la operación es la que
 * queda). Avisa —sin bloquear— si el origen quedaría en negativo.
 *
 * Con `fixedAccounts` (página de una cuenta) uno de los dos lados queda fijo
 * en esa cuenta (o una de sus subcuentas) y se elige si la plata sale de ella
 * o entra en ella.
 */
export function TransferLauncher({
  accounts,
  balances,
  usdRate,
  fixedAccounts,
  buttonClassName,
}: {
  accounts: TransferAccountOption[];
  balances: Record<string, CurrencyTotals>;
  usdRate: number | null;
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
  fixedAccounts,
  onDone,
}: {
  accounts: TransferAccountOption[];
  balances: Record<string, CurrencyTotals>;
  usdRate: number | null;
  fixedAccounts?: TransferAccountOption[];
  onDone: () => void;
}) {
  const [state, formAction] = useActionState<TransferResult, FormData>(createAccountTransfer, {});
  const [fromId, setFromId] = useState(fixedAccounts?.[0]?.id ?? "");
  const [toId, setToId] = useState("");
  // Con cuenta fija: "out" = sale de esta cuenta, "in" = entra en esta cuenta.
  const [direction, setDirection] = useState<"out" | "in">("out");
  const [currency, setCurrency] = useState<Currency>("ars");
  const [amount, setAmount] = useState("");
  const [exchange, setExchange] = useState(false);
  const [toAmount, setToAmount] = useState("");
  const [toTouched, setToTouched] = useState(false);

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  const toCurrency: Currency = exchange ? (currency === "ars" ? "usd" : "ars") : currency;
  const amountNum = Number(amount);
  const suggestion =
    exchange && usdRate && amountNum > 0
      ? round2(currency === "ars" ? amountNum / usdRate : amountNum * usdRate)
      : null;
  const shownToAmount = toTouched ? toAmount : suggestion != null ? String(suggestion) : "";

  const from = accounts.find((a) => a.id === fromId);
  const fromBalance = from ? balances[from.principalId]?.[currency] : undefined;
  const overdrawn = fromBalance != null && amountNum > 0 && amountNum > fromBalance;
  const sameAccount = fromId !== "" && fromId === toId && !exchange;
  const canSubmit =
    fromId !== "" && toId !== "" && amountNum > 0 && !sameAccount && (!exchange || Number(shownToAmount) > 0);

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
          onChange={setFromId}
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
          onChange={setToId}
          placeholder="Buscar cuenta de destino…"
        />
      )}

      <div className="grid grid-cols-[7fr_3fr] gap-2">
        <TextField
          id="fromAmount"
          label="Monto"
          type="number"
          step="0.01"
          min="0"
          prefix={currency === "usd" ? "US$" : "$"}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <CurrencyToggle value={currency} onChange={setCurrency} name="fromCurrency" />
      </div>
      {overdrawn && from && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          Ojo: {from.name} tiene {formatMoney(fromBalance!, currency)} — este traspaso la deja en negativo. Podés
          registrarlo igual.
        </p>
      )}

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
      <input type="hidden" name="toCurrency" value={toCurrency} />
      {exchange && (
        <TextField
          id="toAmount"
          label={`Monto que entra (${toCurrency.toUpperCase()})`}
          type="number"
          step="0.01"
          min="0"
          prefix={toCurrency === "usd" ? "US$" : "$"}
          value={shownToAmount}
          onChange={(e) => {
            setToAmount(e.target.value);
            setToTouched(true);
          }}
          hint={
            usdRate
              ? `Sugerido con el valor de referencia (${formatMoney(usdRate, "ars")}) — ajustalo a la cotización real.`
              : "Todavía no hay un valor de referencia del USD cargado."
          }
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
