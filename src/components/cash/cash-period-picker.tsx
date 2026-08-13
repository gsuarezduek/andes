"use client";

import { useRouter } from "next/navigation";
import { CASH_PERIOD_OPTIONS, type CashPeriod } from "@/lib/cash-period";
import { formatDateInput } from "@/lib/datetime";

type PeriodKind = CashPeriod["kind"];

/**
 * Filtro de fecha de Caja (admin): Hoy / Esta semana / Este mes / fecha
 * puntual. Reemplaza la vieja navegación por mes — cada cambio navega
 * (`router.push`) para que el server traiga los movimientos de ese rango.
 * Al elegir "Fecha específica" navega directo a hoy como valor inicial, y
 * el `<input type="date">` que aparece al lado deja elegir otro día.
 */
export function CashPeriodPicker({ period }: { period: CashPeriod }) {
  const router = useRouter();
  const dateValue = period.kind === "date" ? period.date : formatDateInput(new Date());

  function goTo(kind: PeriodKind, date?: string) {
    if (kind === "date") {
      router.push(`/caja?period=date&date=${date ?? dateValue}`);
    } else {
      router.push(`/caja?period=${kind}`);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={period.kind}
        onChange={(e) => goTo(e.target.value as PeriodKind)}
        className="h-11 rounded-lg border border-foreground/15 bg-transparent px-3 text-sm outline-none focus:border-foreground/40"
      >
        {CASH_PERIOD_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {period.kind === "date" && (
        <input
          type="date"
          value={dateValue}
          onChange={(e) => e.target.value && goTo("date", e.target.value)}
          className="h-11 rounded-lg border border-foreground/15 bg-transparent px-3 text-sm outline-none focus:border-foreground/40"
        />
      )}
    </div>
  );
}
