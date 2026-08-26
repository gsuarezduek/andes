"use client";

import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/contract";
import { formatDateTime } from "@/lib/datetime";
import type { CashMovementRow } from "@/lib/cash";

const MAX_RESULTS = 15;

/**
 * Buscador de un movimiento puntual por nombre de cliente, N° de reserva de
 * VikRentCar, o texto del detalle — filtra client-side sobre `index` (ya
 * traído del server sin acotar al período visible, ver `getCashSearchIndex`),
 * mismo patrón que `RentalPicker`. No navega ni cambia el período de abajo;
 * solo muestra los resultados acá mismo.
 */
export function CashMovementSearch({ index }: { index: CashMovementRow[] }) {
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
              <li key={m.id} className="rounded-lg border border-foreground/10 px-3 py-2 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 whitespace-pre-wrap">{m.description}</p>
                  <p className={`shrink-0 font-semibold ${m.type === "income" ? "text-emerald-600" : "text-red-600"}`}>
                    {m.type === "income" ? "+" : "-"}
                    {formatMoney(m.amount, m.currency)}
                  </p>
                </div>
                <p className="mt-1 text-xs text-foreground/50">
                  {m.type === "income" ? "Cuenta destino" : "Origen"}: {m.paymentMethodName}
                  {m.rentalClientName ? ` · Cliente: ${m.rentalClientName}` : ""}
                  {m.rentalBookingId ? ` · #${m.rentalBookingId}` : ""} · Cargado por: {m.createdByName} ·{" "}
                  {formatDateTime(m.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
