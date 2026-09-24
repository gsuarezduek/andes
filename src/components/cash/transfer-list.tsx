"use client";

import { useState } from "react";
import { ConfirmDeleteCard } from "@/components/ui/confirm-delete-card";
import { formatMoney } from "@/lib/contract";
import { formatDateTime } from "@/lib/datetime";
import { deleteAccountTransfer } from "@/app/(app)/caja/transfer-actions";
import type { AccountTransferRow } from "@/lib/account-transfers-queries";

/**
 * Lista de traspasos entre cuentas (solo admin). Con perspectiva (página de
 * una cuenta, o la Caja fuerte) cada fila se lee desde ahí: "Hacia X" /
 * "Desde X"; sin ella (pestaña Saldos) muestra "Origen → Destino". Eliminar pide un motivo y deja el traspaso fuera de
 * los saldos (no se edita: se elimina y se vuelve a cargar).
 */
export function TransferList({
  transfers,
  perspectiveAccountIds,
  perspectiveSafe = false,
  emptyText = "Todavía no hay traspasos.",
}: {
  transfers: AccountTransferRow[];
  /** Cuenta principal + subcuentas de la página actual, si la hay. */
  perspectiveAccountIds?: string[];
  /** Leer los traspasos desde la Caja fuerte (cuenta nula). */
  perspectiveSafe?: boolean;
  emptyText?: string;
}) {
  if (transfers.length === 0) {
    return <p className="rounded-lg border border-foreground/10 px-3 py-2 text-sm text-foreground/50">{emptyText}</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {transfers.map((t) => (
        <TransferItem key={t.id} transfer={t} perspectiveAccountIds={perspectiveAccountIds} perspectiveSafe={perspectiveSafe} />
      ))}
    </ul>
  );
}

function TransferItem({
  transfer: t,
  perspectiveAccountIds,
  perspectiveSafe,
}: {
  transfer: AccountTransferRow;
  perspectiveAccountIds?: string[];
  perspectiveSafe: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const isCurrency = t.fromCurrency !== t.toCurrency;
  const hasPerspective = perspectiveSafe || perspectiveAccountIds !== undefined;
  const outgoing = perspectiveSafe ? t.fromAccountId === null : t.fromAccountId !== null && perspectiveAccountIds?.includes(t.fromAccountId);
  const incoming = perspectiveSafe ? t.toAccountId === null : t.toAccountId !== null && perspectiveAccountIds?.includes(t.toAccountId);
  // Entre subcuentas de la misma cuenta: se ve de ambos lados, neutro.
  const neutral = outgoing && incoming;

  const title = !hasPerspective
    ? `${t.fromAccountName} → ${t.toAccountName}`
    : neutral
      ? `${t.fromAccountName} → ${t.toAccountName}`
      : outgoing
        ? `Hacia ${t.toAccountName}`
        : `Desde ${t.fromAccountName}`;

  const amountText = isCurrency
    ? `${formatMoney(t.fromAmount, t.fromCurrency)} → ${formatMoney(t.toAmount, t.toCurrency)}`
    : formatMoney(t.fromAmount, t.fromCurrency);

  if (confirming) {
    return (
      <ConfirmDeleteCard
        message={
          <>
            ¿Eliminar el traspaso {title} ({amountText})? Deja de contar en los saldos.
          </>
        }
        action={deleteAccountTransfer.bind(null, t.id)}
        onCancel={() => setConfirming(false)}
        requireNote
      />
    );
  }

  return (
    <li className="flex items-start gap-3 rounded-lg border border-foreground/10 px-3 py-2 text-sm">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-foreground/50">
          {formatDateTime(t.createdAt)} · {t.createdByName}
          {t.description ? ` · ${t.description}` : ""}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-semibold">{amountText}</p>
        <button type="button" onClick={() => setConfirming(true)} className="text-xs text-foreground/40 hover:text-red-600">
          Eliminar
        </button>
      </div>
    </li>
  );
}
