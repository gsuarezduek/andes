import { formatDateInput } from "@/lib/datetime";

export type ProviderLedgerMonthGroup<T> = {
  key: string; // "YYYY-MM"
  label: string; // "Agosto" | "Julio de 2025"
  rows: T[];
};

const MONTH_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  month: "long",
  timeZone: "America/Argentina/Mendoza",
});

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Movimientos cuyo `createdAt` cae en el mismo mes calendario (hora Mendoza) que `now`. */
export function filterThisMonth<T extends { createdAt: Date }>(rows: T[], now: Date): T[] {
  const currentYm = formatDateInput(now).slice(0, 7);
  return rows.filter((r) => formatDateInput(r.createdAt).slice(0, 7) === currentYm);
}

/**
 * Agrupa movimientos por mes calendario (hora Mendoza) para el historial
 * "Ver todos los movimientos" de un proveedor. Asume que ya vienen ordenados
 * por `createdAt` desc (como devuelve `getProviderLedger`) — no reordena,
 * solo junta consecutivos del mismo mes. Mismo patrón que
 * `groupCompletedTasksByDay`, a nivel mes en vez de día.
 */
export function groupProviderLedgerByMonth<T extends { createdAt: Date }>(
  rows: T[],
  now: Date,
): ProviderLedgerMonthGroup<T>[] {
  const currentYear = formatDateInput(now).slice(0, 4);

  const groups: ProviderLedgerMonthGroup<T>[] = [];
  for (const row of rows) {
    const monthKey = formatDateInput(row.createdAt).slice(0, 7);
    const last = groups[groups.length - 1];
    const group =
      last?.key === monthKey
        ? last
        : (() => {
            const year = monthKey.slice(0, 4);
            const monthLabel = capitalize(MONTH_FORMATTER.format(row.createdAt));
            const label = `${monthLabel}${year === currentYear ? "" : ` de ${year}`}`;
            const g: ProviderLedgerMonthGroup<T> = { key: monthKey, label, rows: [] };
            groups.push(g);
            return g;
          })();
    group.rows.push(row);
  }
  return groups;
}
