"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Quién mira Caja: si puede aprobar pedidos de cambio y eliminar directo
 * (admin/finanzas/socio), su id (para "Retirar pedido" en los propios) y las
 * categorías de egreso. Se
 * fija en `caja/layout.tsx` para no pasarlo fila por fila. Fuera de Caja
 * vale el default: sin permisos de aprobación.
 */
export type CashViewer = {
  canApprove: boolean;
  userId: string | null;
  /** Categorías de egreso activas — para formularios que no las reciben por props (ej. "+ Pago" de una cuenta corriente). */
  expenseCategories: { id: string; name: string }[];
};

const CashViewerContext = createContext<CashViewer>({ canApprove: false, userId: null, expenseCategories: [] });

export function CashViewerProvider({ value, children }: { value: CashViewer; children: ReactNode }) {
  return <CashViewerContext.Provider value={value}>{children}</CashViewerContext.Provider>;
}

export function useCashViewer(): CashViewer {
  return useContext(CashViewerContext);
}
