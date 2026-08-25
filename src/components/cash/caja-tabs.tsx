"use client";

import { useState, type ReactNode } from "react";
import { TabBar } from "@/components/ui/tabs";

const SECTIONS = ["Movimientos", "Proveedores", "Caja fuerte"];

/**
 * Caja partida en pestañas: "Movimientos" (Ingreso/Egreso), "Proveedores"
 * (cuenta corriente) y "Caja fuerte" (efectivo físico) — las tres visibles
 * para cualquier rol (lo que cada una muestra por dentro ya varía por rol,
 * ver `caja/page.tsx`). Ya vienen renderizadas desde el server component;
 * acá solo se elige cuál mostrar (mismo patrón que RentalDetailTabs).
 */
export function CajaTabs({
  movimientos,
  proveedores,
  cajaFuerte,
}: {
  movimientos: ReactNode;
  proveedores: ReactNode;
  cajaFuerte: ReactNode;
}) {
  const [section, setSection] = useState(0);
  const panels = [movimientos, proveedores, cajaFuerte];

  return (
    <div className="flex flex-col gap-4">
      <TabBar sections={SECTIONS} active={section} onChange={setSection} />
      {panels[section]}
    </div>
  );
}
