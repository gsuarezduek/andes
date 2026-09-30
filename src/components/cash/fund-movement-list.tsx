"use client";

import { useState } from "react";
import { ConfirmDeleteCard } from "@/components/ui/confirm-delete-card";
import { formatMoney } from "@/lib/contract";
import { formatDateTime } from "@/lib/datetime";
import { deleteFundMovement } from "@/app/(app)/caja/fund-actions";
import type { FundMovementRow } from "@/lib/investment-funds-queries";

/**
 * Historial de depósitos/retiros de fondos de una cuenta (ver `FundsSection`).
 * Eliminar pide un motivo y deja el movimiento fuera del saldo del fondo (no
 * se edita: se elimina y se vuelve a cargar, mismo criterio que Traspasos).
 */
export function FundMovementList({ movements }: { movements: FundMovementRow[] }) {
  if (movements.length === 0) {
    return (
      <p className="rounded-lg border border-foreground/10 px-3 py-2 text-sm text-foreground/50">
        Todavía no hay movimientos de fondos.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {movements.map((m) => (
        <FundMovementItem key={m.id} movement={m} />
      ))}
    </ul>
  );
}

function FundMovementItem({ movement: m }: { movement: FundMovementRow }) {
  const [confirming, setConfirming] = useState(false);
  const isDeposit = m.type === "deposit";
  const label = isDeposit ? "Depósito" : "Retiro";
  const amountText = formatMoney(m.amount, m.currency);

  if (confirming) {
    return (
      <ConfirmDeleteCard
        message={<>¿Eliminar este {label.toLowerCase()} de {amountText}? Deja de contar en el saldo del fondo.</>}
        action={deleteFundMovement.bind(null, m.id)}
        onCancel={() => setConfirming(false)}
        requireNote
      />
    );
  }

  return (
    <li className="flex items-start gap-3 rounded-lg border border-foreground/10 px-3 py-2 text-sm">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {label}
          {m.note ? ` — ${m.note}` : ""}
        </p>
        <p className="mt-0.5 text-xs text-foreground/50">
          {formatDateTime(m.createdAt)} · {m.createdByName}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className={`font-semibold ${isDeposit ? "text-emerald-600" : "text-red-600"}`}>
          {isDeposit ? "+" : "−"}
          {amountText}
        </p>
        <button type="button" onClick={() => setConfirming(true)} className="text-xs text-foreground/40 hover:text-red-600">
          Eliminar
        </button>
      </div>
    </li>
  );
}
