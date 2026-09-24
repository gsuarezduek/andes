"use client";

import { useMemo, useState } from "react";
import type { PaymentMethodOwnership } from "@prisma/client";
import { MovementRow } from "@/components/cash/movement-row";
import type { CashMovementRow } from "@/lib/cash";

type PaymentMethodOption = { id: string; name: string; requiresNote?: boolean; ownership: PaymentMethodOwnership };

const MAX_RESULTS = 15;

/**
 * Buscador de un movimiento puntual por nombre de cliente, N° de reserva de
 * VikRentCar, o texto del detalle — filtra client-side sobre `index` (ya
 * traído del server sin acotar al período visible, ver `getCashSearchIndex`),
 * mismo patrón que `RentalPicker`. No navega ni cambia el período de abajo;
 * solo muestra los resultados acá mismo. Cada resultado es un `MovementRow`:
 * tocarlo abre el detalle y, si `canEdit` (admin), Editar/Eliminar.
 */
export function CashMovementSearch({
  index,
  paymentMethods,
  expenseCategories,
  canEdit,
}: {
  index: CashMovementRow[];
  paymentMethods: PaymentMethodOption[];
  expenseCategories: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return index
      .filter(
        (m) =>
          m.description.toLowerCase().includes(q) ||
          (m.rentalClientName?.toLowerCase().includes(q) ?? false) ||
          (m.rentalBookingId?.includes(q) ?? false),
      )
      .slice(0, MAX_RESULTS);
  }, [query, index]);

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por cliente o N° de reserva…"
        className="h-11 w-full rounded-lg border border-foreground/15 bg-transparent px-3 text-base outline-none focus:border-foreground/40"
      />
      {query.trim() &&
        (matches.length === 0 ? (
          <p className="rounded-lg border border-foreground/10 px-3 py-2 text-sm text-foreground/50">
            Sin coincidencias.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {matches.map((m) => (
              <MovementRow
                key={m.id}
                movement={m}
                tone={m.type === "income" ? "emerald" : "red"}
                paymentMethods={paymentMethods}
                expenseCategories={expenseCategories}
                canEdit={canEdit}
              />
            ))}
          </ul>
        ))}
    </div>
  );
}
