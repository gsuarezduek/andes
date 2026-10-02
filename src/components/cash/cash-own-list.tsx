import type { PaymentMethodOwnership } from "@prisma/client";
import { SectionTitle } from "@/components/ui/section-title";
import { MovementRow } from "./movement-row";
import { movementRowKey } from "./movement-row-key";
import type { CashMovementRow } from "@/lib/cash";

type PaymentMethodOption = { id: string; name: string; requiresNote?: boolean; ownership: PaymentMethodOwnership };
type ExpenseCategoryOption = { id: string; name: string };

/**
 * Egresos propios del mes (un no-admin no ve los de otros — ver
 * `getOwnCashMovements`), editables/eliminables como cualquier movimiento.
 */
export function CashOwnList({
  items,
  paymentMethods,
  expenseCategories,
}: {
  items: CashMovementRow[];
  paymentMethods: PaymentMethodOption[];
  expenseCategories: ExpenseCategoryOption[];
}) {
  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>Mis movimientos de este mes</SectionTitle>
      {items.length === 0 ? (
        <p className="rounded-lg border border-foreground/10 px-3 py-2 text-sm text-foreground/50">
          Todavía no cargaste movimientos este mes.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((r) => (
            <MovementRow
              key={movementRowKey(r)}
              movement={r}
              tone={r.type === "income" ? "emerald" : "red"}
              paymentMethods={paymentMethods}
              expenseCategories={expenseCategories}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
