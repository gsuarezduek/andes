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
  contrato,
  openContract = false,
}: {
  general: ReactNode;
  danos: ReactNode;
  alquileres: ReactNode;
  mantenimiento: ReactNode;
  /** Contrato con el titular: solo existe en autos de terceros. */
  contrato?: ReactNode;
  /** Abre directo en esa pestaña (ej. al volver de firmar un contrato). */
  openContract?: boolean;
}) {
  const sections = contrato ? [...SECTIONS, "Contrato"] : SECTIONS;
  const panels = contrato ? [general, danos, alquileres, mantenimiento, contrato] : [general, danos, alquileres, mantenimiento];
  const [section, setSection] = useState(contrato && openContract ? SECTIONS.length : 0);

  return (
    <div className="flex flex-col gap-4">
      <TabBar sections={sections} active={section} onChange={setSection} />
      {panels[section]}
    </div>
  );
}
