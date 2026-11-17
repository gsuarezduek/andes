/**
 * Filtro de movimientos de Caja por cuenta, tipo y categoría — puro (sin
 * "server-only" ni Prisma) para que lo compartan la pantalla de Movimientos
 * (`CashMovementsBoard`, client-side sobre lo ya traído) y el export CSV
 * (`/api/caja/export`), y así el archivo baje exactamente lo mismo que se ve.
 */

export type CashMovementTypeFilter = "all" | "income" | "expense";

/** Sentinel de "egresos sin categoría cargada" en el filtro de categoría. */
export const NO_CATEGORY = "__none__";

type FilterableRow = {
  paymentMethodId: string | null;
  recipientPaymentMethodId: string | null;
  categoryId: string | null;
};

/**
 * Elegir una cuenta principal (`PaymentMethod.parentId`) suma también sus
 * subcuentas — misma entidad. Elegir una subcuenta puntual no "sube" a sus
 * hermanas. Sin selección devuelve [] (= todas las cuentas).
 */
export function expandAccountIds(
  selected: string[],
  methods: { id: string; parentId?: string | null }[],
): string[] {
  const set = new Set(selected);
  for (const m of methods) {
    if (m.parentId && selected.includes(m.parentId)) set.add(m.id);
  }
  return [...set];
}

/**
 * `accountIds` ya expandidos (ver `expandAccountIds`); vacío = todas. Un
 * Ingreso matchea por su cuenta; un Egreso por su Origen o su Destino (cuenta
 * ajena). La categoría solo aplica a Egresos (los Ingresos no la llevan).
 */
export function filterCashMovements<T extends FilterableRow>(
  data: { incomes: T[]; expenses: T[] },
  filter: { accountIds: string[]; categoryId?: string; type?: CashMovementTypeFilter },
): { incomes: T[]; expenses: T[] } {
  const { accountIds, categoryId = "", type = "all" } = filter;
  const inAccounts = (id: string | null) => id !== null && accountIds.includes(id);

  const incomes =
    type === "expense"
      ? []
      : accountIds.length
        ? data.incomes.filter((r) => inAccounts(r.paymentMethodId))
        : data.incomes;

  let expenses =
    type === "income"
      ? []
      : accountIds.length
        ? data.expenses.filter((r) => inAccounts(r.paymentMethodId) || inAccounts(r.recipientPaymentMethodId))
        : data.expenses;
  if (categoryId) {
    expenses = expenses.filter((r) => (categoryId === NO_CATEGORY ? !r.categoryId : r.categoryId === categoryId));
  }

  return { incomes, expenses };
}

/** Query string del export (se suma a la del período, ver `cashPeriodSearch`). */
export function cashExportFilterSearch(filter: {
  accountIds: string[];
  categoryId?: string;
  type?: CashMovementTypeFilter;
}): string {
  const params = new URLSearchParams();
  for (const id of filter.accountIds) params.append("account", id);
  if (filter.categoryId) params.set("category", filter.categoryId);
  if (filter.type && filter.type !== "all") params.set("type", filter.type);
  return params.toString();
}

/** Inverso de `cashExportFilterSearch`. Un `type` desconocido cae a "all". */
export function parseCashExportFilter(params: URLSearchParams): {
  accountIds: string[];
  categoryId: string;
  type: CashMovementTypeFilter;
} {
  const rawType = params.get("type");
  return {
    accountIds: params.getAll("account").filter(Boolean),
    categoryId: params.get("category") ?? "",
    type: rawType === "income" || rawType === "expense" ? rawType : "all",
  };
}
