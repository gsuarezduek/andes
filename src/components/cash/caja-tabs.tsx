"use client";

import { useState, type ReactNode } from "react";
import { TabBar } from "@/components/ui/tabs";

const SECTIONS = ["Movimientos", "Proveedores"];

/**
 * Caja partida en pestañas: "Movimientos" (Ingreso/Egreso/Deuda/Caja fuerte,
 * lo que ya había) y "Proveedores" (cuenta corriente, nueva — solo admin, ver
 * `caja/page.tsx`). Ambas ya vienen renderizadas desde el server component;
 * acá solo se elige cuál mostrar (mismo patrón que RentalDetailTabs).
 * `proveedores` es `undefined` para no-admin: en ese caso no hay pestañas,
 * se muestra directo el contenido de Movimientos.
 */
export function CajaTabs({ movimientos, proveedores }: { movimientos: ReactNode; proveedores?: ReactNode }) {
  const [section, setSection] = useState(0);

  if (proveedores === undefined) return <>{movimientos}</>;

  const panels = [movimientos, proveedores];
  return (
    <div className="flex flex-col gap-4">
      <TabBar sections={SECTIONS} active={section} onChange={setSection} />
      {panels[section]}
    </div>
  );
}
