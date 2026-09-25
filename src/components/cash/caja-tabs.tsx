"use client";

import { useState, type ReactNode } from "react";
import { TabBar } from "@/components/ui/tabs";

/**
 * Caja partida en pestañas: "Movimientos" (Ingreso/Egreso), "Asociados"
 * (resumen por asociado), "Cuentas corrientes" (ex-"Proveedores", cuenta
 * corriente por proveedor), "Garantías" (depósitos tomados/devueltos, ver
 * `RentalPayment.isGuarantee`) y "Saldos" (ex-"Cuentas propias": saldo +
 * historial de cada cuenta propia, cada una en su propia página — solo
 * admin, ver abajo). La Caja fuerte ya no tiene pestaña propia: es una
 * tarjeta más dentro de Saldos (v44, ver `AccountsSection`). Las primeras
 * tres son visibles para cualquier rol (lo que cada una muestra por dentro
 * ya varía por rol, ver `caja/page.tsx`); "Garantías" y "Saldos" directamente
 * no se pasan (quedan `undefined`) para un no-admin, así que ni sus pestañas
 * aparecen — son la posición de plata real de la empresa. Ya vienen
 * renderizadas desde el server component; acá solo se elige cuál mostrar
 * (mismo patrón que RentalDetailTabs).
 */
export function CajaTabs({
  movimientos,
  asociados,
  proveedores,
  garantias,
  saldos,
}: {
  movimientos: ReactNode;
  asociados: ReactNode;
  proveedores: ReactNode;
  garantias?: ReactNode;
  saldos?: ReactNode;
}) {
  const [section, setSection] = useState(0);
  const entries: { label: string; panel: ReactNode }[] = [
    { label: "Movimientos", panel: movimientos },
    { label: "Asociados", panel: asociados },
    { label: "Cuentas corrientes", panel: proveedores },
    ...(garantias !== undefined ? [{ label: "Garantías", panel: garantias }] : []),
    ...(saldos !== undefined ? [{ label: "Saldos", panel: saldos }] : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <TabBar sections={entries.map((e) => e.label)} active={section} onChange={setSection} />
      {entries[section]?.panel}
    </div>
  );
}
