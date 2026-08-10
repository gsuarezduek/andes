"use client";

import { useState, type ReactNode } from "react";
import { TabBar } from "@/components/ui/tabs";

const SECTIONS = ["Datos", "Pagos", "Documentos", "Inspecciones"];

/**
 * Detalle de la reserva partido en pestañas — antes era un solo scroll largo
 * (cliente, fechas, pagos, historial, documentos, inspecciones) en 375px. Las
 * secciones ya vienen renderizadas desde el server component (page.tsx, con
 * todos sus datos ya resueltos); acá solo se elige cuál mostrar. Lo que sigue
 * siendo importante ver siempre (notas del equipo, avisos, acciones) queda
 * afuera de las pestañas, en la página.
 */
export function RentalDetailTabs({
  datos,
  pagos,
  documentos,
  inspecciones,
}: {
  datos: ReactNode;
  pagos: ReactNode;
  documentos: ReactNode;
  inspecciones: ReactNode;
}) {
  const [section, setSection] = useState(0);
  const panels = [datos, pagos, documentos, inspecciones];

  return (
    <div className="flex flex-col gap-4">
      <TabBar sections={SECTIONS} active={section} onChange={setSection} />
      {panels[section]}
    </div>
  );
}
