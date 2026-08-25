"use client";

import { useState, type ReactNode } from "react";
import { TabBar } from "@/components/ui/tabs";

const SECTIONS = ["Movimientos", "Asociados", "Proveedores", "Caja fuerte"];

/**
 * Caja partida en pestañas: "Movimientos" (Ingreso/Egreso), "Asociados"
 * (resumen por asociado), "Proveedores" (cuenta corriente) y "Caja fuerte"
 * (efectivo físico) — las cuatro visibles para cualquier rol (lo que cada una
 * muestra por dentro ya varía por rol, ver `caja/page.tsx`). Ya vienen
 * renderizadas desde el server component; acá solo se elige cuál mostrar
 * (mismo patrón que RentalDetailTabs).
 */
export function CajaTabs({
  movimientos,
  asociados,
  proveedores,
  cajaFuerte,
}: {
  movimientos: ReactNode;
  asociados: ReactNode;
  proveedores: ReactNode;
  cajaFuerte: ReactNode;
}) {
  const [section, setSection] = useState(0);
  const panels = [movimientos, asociados, proveedores, cajaFuerte];

  return (
    <div className="flex flex-col gap-4">
      <TabBar sections={SECTIONS} active={section} onChange={setSection} />
      {panels[section]}
    </div>
  );
}
