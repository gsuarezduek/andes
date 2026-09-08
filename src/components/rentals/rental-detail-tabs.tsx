"use client";

import { useState, type ReactNode } from "react";
import { TabBar } from "@/components/ui/tabs";

/**
 * Detalle de la reserva partido en pestañas — antes era un solo scroll largo
 * (cliente, fechas, pagos, historial, documentos, inspecciones) en 375px. Las
 * secciones ya vienen renderizadas desde el server component (page.tsx, con
 * todos sus datos ya resueltos); acá solo se elige cuál mostrar. Lo que sigue
 * siendo importante ver siempre (notas del equipo, avisos, acciones) queda
 * afuera de las pestañas, en la página.
 *
 * "WhatsApp" es opcional: solo se agrega si esta reserva tiene una
 * conversación vinculada (ver `getConversationForRental`) — no tiene sentido
 * mostrar una pestaña vacía en el resto de las reservas.
 */
export function RentalDetailTabs({
  datos,
  pagos,
  documentos,
  inspecciones,
  whatsapp,
}: {
  datos: ReactNode;
  pagos: ReactNode;
  documentos: ReactNode;
  inspecciones: ReactNode;
  whatsapp?: ReactNode;
}) {
  const [section, setSection] = useState(0);
  const sections = ["Datos", "Pagos", "Documentos", "Inspecciones", ...(whatsapp ? ["WhatsApp"] : [])];
  const panels = [datos, pagos, documentos, inspecciones, ...(whatsapp ? [whatsapp] : [])];

  return (
    <div className="flex flex-col gap-4">
      <TabBar sections={sections} active={section} onChange={setSection} />
      {panels[section]}
    </div>
  );
}
