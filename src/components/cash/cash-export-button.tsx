"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { buttonClass } from "@/components/ui/button";
import { groupSubaccounts } from "@/lib/subaccount-order";
import { cashPeriodSearch, type CashPeriod } from "@/lib/cash-period";
import {
  NO_CATEGORY,
  cashExportFilterSearch,
  expandAccountIds,
  filterCashMovements,
  type CashMovementTypeFilter,
} from "@/lib/cash-movement-filter";
import type { CashMovementRow } from "@/lib/cash";
import type { ExpenseCategoryOption, PaymentMethodOption } from "./cash-movements-board";

const GROUPS = [
  { ownership: "own", label: "Propias" },
  { ownership: "associate", label: "Asociados" },
  { ownership: "provider", label: "Proveedores" },
  { ownership: "misc", label: "Varios" },
] as const;

const TYPE_OPTIONS: { value: CashMovementTypeFilter; label: string }[] = [
  { value: "all", label: "Ingresos y egresos" },
  { value: "income", label: "Solo ingresos" },
  { value: "expense", label: "Solo egresos" },
];

/**
 * "Exportar CSV" de Caja con filtros: una o varias cuentas (ej. débito +
 * crédito = "solo tarjetas"), tipo de movimiento y categoría de egreso, sobre
 * el período elegido arriba. Arranca con los filtros que ya hay en pantalla.
 * La cantidad que se va a exportar se calcula acá con el mismo filtro puro que
 * usa el servidor, sobre los movimientos del período ya cargados.
 */
export function CashExportButton({
  incomes,
  expenses,
  paymentMethods,
  expenseCategories,
  period,
  periodLabel,
  initialAccountId,
  initialCategoryId,
}: {
  incomes: CashMovementRow[];
  expenses: CashMovementRow[];
  paymentMethods: PaymentMethodOption[];
  expenseCategories: ExpenseCategoryOption[];
  period: CashPeriod;
  periodLabel: string;
  initialAccountId: string;
  initialCategoryId: string;
}) {
  const [open, setOpen] = useState(false);
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [type, setType] = useState<CashMovementTypeFilter>("all");
  const [categoryId, setCategoryId] = useState("");

  function openModal() {
    setAccountIds(initialAccountId ? [initialAccountId] : []);
    setCategoryId(initialCategoryId);
    setType("all");
    setOpen(true);
  }

  function toggleAccount(id: string) {
    setAccountIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const effectiveCategory = type === "income" ? "" : categoryId;
  const preview = filterCashMovements(
    { incomes, expenses },
    { accountIds: expandAccountIds(accountIds, paymentMethods), categoryId: effectiveCategory, type },
  );
  const count = preview.incomes.length + preview.expenses.length;
  const filterSearch = cashExportFilterSearch({ accountIds, categoryId: effectiveCategory, type });
  const href = `/api/caja/export?${cashPeriodSearch(period)}${filterSearch ? `&${filterSearch}` : ""}`;

  return (
    <>
      <button type="button" onClick={openModal} className={buttonClass("secondary", "h-11")}>
        Exportar CSV
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Exportar CSV" className="max-w-md">
        <div className="flex flex-col gap-4 text-sm">
          <p className="text-foreground/60">
            Período: <span className="font-medium text-foreground">{periodLabel}</span>
            <span className="block text-xs">Para otro período, cambialo en el selector de fecha antes de exportar.</span>
          </p>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 font-medium text-foreground/80">Movimientos</legend>
            <div className="flex flex-wrap gap-2">
              {TYPE_OPTIONS.map((o) => (
                <label
                  key={o.value}
                  className={`cursor-pointer rounded-full border px-3 py-1.5 ${
                    type === o.value ? "border-foreground bg-foreground text-background" : "border-foreground/15"
                  }`}
                >
                  <input
                    type="radio"
                    name="export-type"
                    value={o.value}
                    checked={type === o.value}
                    onChange={() => setType(o.value)}
                    className="sr-only"
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 font-medium text-foreground/80">Cuentas</legend>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={accountIds.length === 0}
                onChange={() => setAccountIds([])}
                className="h-4 w-4"
              />
              Todas las cuentas
            </label>
            <div className="flex max-h-60 flex-col gap-3 overflow-y-auto rounded-lg border border-foreground/10 p-3">
              {GROUPS.map((g) => {
                const methods = paymentMethods.filter((m) => m.ownership === g.ownership);
                if (methods.length === 0) return null;
                return (
                  <div key={g.ownership} className="flex flex-col gap-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">{g.label}</p>
                    {groupSubaccounts(methods).map(({ item, isChild }) => {
                      const parentChecked = isChild && !!item.parentId && accountIds.includes(item.parentId);
                      return (
                        <label key={item.id} className={`flex items-center gap-2 ${isChild ? "ml-5" : ""}`}>
                          <input
                            type="checkbox"
                            checked={parentChecked || accountIds.includes(item.id)}
                            disabled={parentChecked}
                            onChange={() => toggleAccount(item.id)}
                            className="h-4 w-4"
                          />
                          {isChild && <span className="text-foreground/40">↳</span>}
                          {item.name}
                        </label>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-foreground/50">
              Podés marcar varias (ej. débito y crédito). Una cuenta principal incluye sus subcuentas. Un egreso entra
              si la cuenta es su origen o su destino.
            </p>
          </fieldset>

          <label className="flex flex-col gap-1.5">
            <span className="font-medium text-foreground/80">Categoría (egresos)</span>
            <select
              value={effectiveCategory}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={type === "income"}
              className="h-11 rounded-lg border border-foreground/15 bg-transparent px-3 outline-none focus:border-foreground/40 disabled:opacity-50"
            >
              <option value="">Todas las categorías</option>
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value={NO_CATEGORY}>Sin categoría</option>
            </select>
          </label>

          <div className="flex flex-col gap-2 border-t border-foreground/10 pt-3">
            <p className="text-foreground/60">
              {count === 0
                ? "No hay movimientos con estos filtros en el período."
                : `Se van a exportar ${count} ${count === 1 ? "movimiento" : "movimientos"} (${preview.incomes.length} ingresos, ${preview.expenses.length} egresos).`}
            </p>
            {count === 0 ? (
              <span className={buttonClass("primary", "pointer-events-none opacity-50")} aria-disabled="true">
                Descargar CSV
              </span>
            ) : (
              <a href={href} onClick={() => setOpen(false)} className={buttonClass("primary")}>
                Descargar CSV
              </a>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
