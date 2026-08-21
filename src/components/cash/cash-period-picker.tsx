"use client";

import { useRouter } from "next/navigation";
import { CASH_PERIOD_OPTIONS, type CashPeriod } from "@/lib/cash-period";
import { formatDateInput } from "@/lib/datetime";

type PeriodKind = CashPeriod["kind"];

/**
 * Filtro de fecha de Caja (admin): Hoy / Esta semana / Este mes / rango de
 * fechas. Reemplaza la vieja navegación por mes — cada cambio navega
 * (`router.push`) para que el server traiga los movimientos de ese rango.
 * Al elegir "Rango de fechas" navega directo a hoy–hoy como valor inicial, y
 * los dos `<input type="date">` que aparecen al lado dejan ajustar el rango
 * (un solo día es el caso particular "desde" === "hasta").
 */
export function CashPeriodPicker({ period }: { period: CashPeriod }) {
  const router = useRouter();
  const today = formatDateInput(new Date());
  const from = period.kind === "date" ? period.from : today;
  const to = period.kind === "date" ? period.to : today;

  function goTo(kind: PeriodKind) {
    if (kind === "date") router.push(`/caja?period=date&from=${from}&to=${to}`);
    else router.push(`/caja?period=${kind}`);
  }

  function updateRange(nextFrom: string, nextTo: string) {
    router.push(`/caja?period=date&from=${nextFrom}&to=${nextTo}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
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
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={from}
            onChange={(e) => e.target.value && updateRange(e.target.value, to)}
            className="h-11 rounded-lg border border-foreground/15 bg-transparent px-3 text-sm outline-none focus:border-foreground/40"
          />
          <span className="text-sm text-foreground/50">a</span>
          <input
            type="date"
            value={to}
            onChange={(e) => e.target.value && updateRange(from, e.target.value)}
            className="h-11 rounded-lg border border-foreground/15 bg-transparent px-3 text-sm outline-none focus:border-foreground/40"
          />
        </div>
      )}
    </div>
  );
}
