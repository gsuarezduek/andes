import { formatDateInput } from "@/lib/datetime";
import { sumByCurrency, type Currency, type CurrencyTotals } from "@/lib/currency";

/**
 * Vista por mes de Caja → Facturación (pura, sin Prisma, testeada). Un
 * ingreso pertenece al mes en que entró (`createdAt`, hora Mendoza) — tanto
 * si sigue pendiente como si ya se facturó —, así las tarjetas y la lista de
 * un mes hablan siempre del mismo conjunto de ingresos.
 */

/** "all" = todo el historial (la vista de siempre); si no, "YYYY-MM". */
export type InvoicingMonth = "all" | string;

export function incomeMonthKey(m: { createdAt: Date }): string {
  return formatDateInput(m.createdAt).slice(0, 7);
}

/** `Invoice.date` es `@db.Date` (fecha pura, guardada a medianoche UTC): no pasa por la zona horaria. */
export function invoiceLogMonthKey(inv: { date: Date }): string {
  return inv.date.toISOString().slice(0, 7);
}

const MONTH_FORMATTER = new Intl.DateTimeFormat("es-AR", { month: "long", timeZone: "UTC" });

/** "2026-11" → "Noviembre 2026". */
export function invoicingMonthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const name = MONTH_FORMATTER.format(new Date(Date.UTC(y, m - 1, 15)));
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
}

/**
 * Meses para el selector: los que tienen algún ingreso o factura cargada,
 * más el mes actual (aunque esté vacío), del más nuevo al más viejo.
 */
export function invoicingMonthOptions(keys: string[], now: Date): { key: string; label: string }[] {
  const all = new Set([...keys, formatDateInput(now).slice(0, 7)]);
  return [...all]
    .sort((a, b) => (a < b ? 1 : -1))
    .map((key) => ({ key, label: invoicingMonthLabel(key) }));
}

export type InvoicingSummary = {
  pendingTotal: CurrencyTotals;
  invoicedTotal: CurrencyTotals;
  pendingCount: number;
  invoicedCount: number;
  /** % de ingresos ya facturados (por cantidad, no por monto: no se mezclan pesos y dólares). Null si no hay ninguno. */
  progressPercent: number | null;
};

export function summarizeInvoicing(
  rows: { amount: number; currency: Currency; invoicedAt: Date | null }[],
): InvoicingSummary {
  const pending = rows.filter((m) => !m.invoicedAt);
  const invoiced = rows.filter((m) => !!m.invoicedAt);
  return {
    pendingTotal: sumByCurrency(pending),
    invoicedTotal: sumByCurrency(invoiced),
    pendingCount: pending.length,
    invoicedCount: invoiced.length,
    progressPercent: rows.length === 0 ? null : Math.round((invoiced.length / rows.length) * 100),
  };
}
