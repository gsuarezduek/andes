"use client";

import { useState } from "react";
import type { PaymentMethodOwnership } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { CashMovementForm } from "@/components/cash/cash-movement-form";
import { TransferLauncher } from "@/components/cash/transfer-launcher";
import type { TransferAccountOption } from "@/lib/account-transfers";
import type { CurrencyTotals } from "@/lib/currency";
import type { RentalPickerOption, RoomBookingPickerOption } from "@/lib/cash";

type PaymentMethodOption = {
  id: string;
  name: string;
  requiresNote: boolean;
  ownership: PaymentMethodOwnership;
  parentId: string | null;
};

/**
 * "+ Ingreso / + Egreso / Mover entre cuentas" desde la página de una cuenta
 * propia (`/caja/saldos/[id]`): los mismos formularios de Movimientos y del
 * header de Caja, con la cuenta fija (`accountIds`: la principal primero y
 * después sus subcuentas).
 */
export function AccountQuickActions({
  accountIds,
  paymentMethods,
  rentalOptions,
  roomBookingOptions,
  expenseCategories,
  transferAccounts,
  transferBalances,
  usdRate,
}: {
  accountIds: string[];
  paymentMethods: PaymentMethodOption[];
  rentalOptions: RentalPickerOption[];
  roomBookingOptions: RoomBookingPickerOption[];
  expenseCategories: { id: string; name: string }[];
  transferAccounts: TransferAccountOption[];
  transferBalances: Record<string, CurrencyTotals>;
  usdRate: number | null;
}) {
  const [action, setAction] = useState<"income" | "expense" | null>(null);
  const fixedTransferAccounts = accountIds.flatMap((id) => transferAccounts.filter((a) => a.id === id));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" className="flex-1" onClick={() => setAction("income")} disabled={action !== null}>
          + Ingreso
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={() => setAction("expense")}
          disabled={action !== null}
        >
          + Egreso
        </Button>
        <TransferLauncher
          accounts={transferAccounts}
          balances={transferBalances}
          usdRate={usdRate}
          fixedAccounts={fixedTransferAccounts}
          buttonClassName="w-full sm:w-auto sm:flex-1"
        />
      </div>
      {action && (
        <CashMovementForm
          key={action}
          mode={action}
          onCancel={() => setAction(null)}
          accountIds={accountIds}
          paymentMethods={paymentMethods}
          rentalOptions={rentalOptions}
          roomBookingOptions={roomBookingOptions}
          expenseCategories={expenseCategories}
        />
      )}
    </div>
  );
}
