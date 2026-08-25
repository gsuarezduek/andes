"use client";

import { useState, type ReactNode } from "react";
import { TabBar } from "@/components/ui/tabs";

/**
 * Caja partida en pestañas: "Movimientos" (Ingreso/Egreso), "Proveedores"
 * (cuenta corriente — solo admin, ver `caja/page.tsx`) y "Caja fuerte"
 * (efectivo físico, siempre visible). Todas ya vienen renderizadas desde el
 * server component; acá solo se elige cuál mostrar (mismo patrón que
 * RentalDetailTabs). `proveedores` es `undefined` para no-admin: en ese caso
 * la pestaña ni aparece.
 */
export function CajaTabs({
  movimientos,
  proveedores,
  cajaFuerte,
}: {
  movimientos: ReactNode;
  proveedores?: ReactNode;
  cajaFuerte: ReactNode;
}) {
  const [section, setSection] = useState(0);

  const sections = proveedores !== undefined ? ["Movimientos", "Proveedores", "Caja fuerte"] : ["Movimientos", "Caja fuerte"];
  const panels = proveedores !== undefined ? [movimientos, proveedores, cajaFuerte] : [movimientos, cajaFuerte];

  return (
    <div className="flex flex-col gap-4">
      <TabBar sections={sections} active={section} onChange={setSection} />
      {panels[section]}
    </div>
  );
}
