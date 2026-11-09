"use client";

import { PaymentMethodPicker, type PaymentMethodPickerOption } from "./payment-method-picker";

/**
 * Cuenta fija de un formulario abierto desde la página de una cuenta
 * (`/caja/saldos/[id]`): si la cuenta no tiene subcuentas se muestra sin
 * poder cambiarla; si tiene, se elige solo entre la principal y sus
 * subcuentas (el saldo es el mismo, pero cada movimiento queda en una cuenta
 * puntual).
 */
export function FixedAccountField<T extends PaymentMethodPickerOption>({
  id,
  name,
  label,
  options,
  value,
  onChange,
}: {
  id: string;
  name?: string;
  label: string;
  options: T[];
  value: string;
  onChange: (id: string) => void;
}) {
  if (options.length > 1) {
    return (
      <PaymentMethodPicker
        id={id}
        name={name}
        label={label}
        hint="Esta cuenta o una de sus subcuentas"
        options={options}
        value={value}
        onChange={onChange}
        placeholder="Elegí la cuenta…"
      />
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground/80">{label}</span>
      <input type="hidden" name={name ?? id} value={value} />
      <div className="flex h-11 items-center rounded-lg border border-foreground/10 bg-foreground/[0.03] px-3 text-base">
        <span className="min-w-0 truncate">{options[0]?.name ?? "—"}</span>
      </div>
    </div>
  );
}
