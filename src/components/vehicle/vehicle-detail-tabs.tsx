"use client";

import { useState, type ReactNode } from "react";
import { TabBar } from "@/components/ui/tabs";

const SECTIONS = ["General", "Daños", "Alquileres", "Mantenimiento"];

/**
 * Ficha del vehículo partida en pestañas — antes era un solo scroll largo que
 * se iba haciendo cada vez más largo a medida que el auto acumulaba
 * alquileres, inspecciones y service. Mismo patrón que RentalDetailTabs: las
 * secciones ya vienen renderizadas desde el server component (page.tsx) con
 * los datos resueltos, acá solo se elige cuál mostrar. Lo que sigue siendo
 * importante ver siempre (notas del equipo, acciones) queda afuera de las
 * pestañas, arriba en la página.
 */
export function VehicleDetailTabs({
  general,
  danos,
  alquileres,
  mantenimiento,
}: {
  general: ReactNode;
  danos: ReactNode;
  alquileres: ReactNode;
  mantenimiento: ReactNode;
}) {
  const [section, setSection] = useState(0);
  const panels = [general, danos, alquileres, mantenimiento];

  return (
    <div className="flex flex-col gap-4">
      <TabBar sections={SECTIONS} active={section} onChange={setSection} />
      {panels[section]}
    </div>
  );
}
