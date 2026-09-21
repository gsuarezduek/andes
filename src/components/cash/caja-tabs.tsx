"use client";

import { useState, type ReactNode } from "react";
import { TabBar } from "@/components/ui/tabs";

/**
 * Caja partida en pestañas: "Movimientos" (Ingreso/Egreso), "Asociados"
 * (resumen por asociado), "Cuentas corrientes" (ex-"Proveedores", cuenta
 * corriente por proveedor), "Cuentas propias" (saldo + movimientos de cada
 * cuenta propia — solo admin, ver abajo) y "Caja fuerte" (efectivo físico).
 * Las primeras cuatro son visibles para cualquier rol (lo que cada una
 * muestra por dentro ya varía por rol, ver `caja/page.tsx`); "Cuentas
 * propias" directamente no se pasa (queda `undefined`) para un no-admin, así
 * que ni su pestaña aparece — es la posición de plata real de la empresa,
 * mismo criterio que Caja fuerte/Billetera. Ya vienen renderizadas desde el
 * server component; acá solo se elige cuál mostrar (mismo patrón que
 * RentalDetailTabs).
 */
export function CajaTabs({
  movimientos,
  asociados,
  proveedores,
  cuentas,
  cajaFuerte,
}: {
  movimientos: ReactNode;
  asociados: ReactNode;
  proveedores: ReactNode;
  cuentas?: ReactNode;
  cajaFuerte: ReactNode;
}) {
  const [section, setSection] = useState(0);
  const entries: { label: string; panel: ReactNode }[] = [
    { label: "Movimientos", panel: movimientos },
    { label: "Asociados", panel: asociados },
    { label: "Cuentas corrientes", panel: proveedores },
    ...(cuentas !== undefined ? [{ label: "Cuentas propias", panel: cuentas }] : []),
    { label: "Caja fuerte", panel: cajaFuerte },
  ];

  return (
    <div className="flex flex-col gap-4">
      <TabBar sections={entries.map((e) => e.label)} active={section} onChange={setSection} />
      {entries[section]?.panel}
    </div>
  );
}
