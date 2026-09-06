"use client";

import { usePathname } from "next/navigation";
import { DesktopNav } from "@/components/nav/desktop-nav";
import { MobileNav } from "@/components/nav/mobile-nav";
import type { SyncOutcome } from "@/components/nav/sync-button";
import type { Item } from "@/components/nav/types";

/**
 * Navegación de la app.
 *
 * - Menú principal (siempre visible en desktop): Alquileres, WhatsApp, Calendario, Vehículos,
 *   Caja, Tareas, y para admin además Reportes — antes vivía enterrado en el submenú de cuenta, tan
 *   frecuente para un admin como el resto de la barra principal. Usuarios vive dentro de
 *   Configuración (`/users`, un ítem más de esa pantalla), no en la barra. Tareas muestra un
 *   contador rojo con las tareas pendientes asignadas al usuario logueado (`taskCount`).
 * - Submenú de cuenta (desplegable a la derecha, donde estaba "Salir"):
 *   Perfil, Sincronización, GPS, Configuración (solo admin), "Ver como empleado"
 *   (solo si `isRealAdmin` — deja probar la vista de un usuario normal sin salir
 *   de la sesión de admin) y Salir — ajustes/administración menos frecuentes que
 *   la navegación operativa de la barra principal.
 * - En mobile todo colapsa en un menú hamburguesa.
 */
export function AppNav({
  isAdmin,
  userName,
  logout,
  sync,
  taskCount,
  whatsappUnread,
  isRealAdmin,
  viewingAsEmployee,
  enableEmployeeView,
  disableEmployeeView,
}: {
  isAdmin: boolean;
  userName?: string | null;
  logout: () => void;
  sync?: () => Promise<SyncOutcome>;
  taskCount?: number;
  /** Conversaciones de WhatsApp pendientes de respuesta — mismo criterio visual que `taskCount`. */
  whatsappUnread?: number;
  /** Rol real de la sesión (no el efectivo tras "Ver como empleado"). */
  isRealAdmin?: boolean;
  viewingAsEmployee?: boolean;
  enableEmployeeView?: () => Promise<void>;
  disableEmployeeView?: () => Promise<void>;
}) {
  const pathname = usePathname();

  const viewToggle =
    isRealAdmin && enableEmployeeView && disableEmployeeView
      ? viewingAsEmployee
        ? { label: "Volver a vista admin", action: disableEmployeeView, active: true }
        : { label: "Ver como empleado", action: enableEmployeeView, active: false }
      : undefined;

  const mainItems: Item[] = [
    { href: "/rentals", label: "Alquileres" },
    { href: "/whatsapp", label: "WhatsApp", badge: whatsappUnread },
    { href: "/calendar", label: "Calendario" },
    { href: "/vehicles", label: "Vehículos" },
    { href: "/caja", label: "Caja" },
    { href: "/tasks", label: "Tareas", badge: taskCount },
    ...(isAdmin ? [{ href: "/reports", label: "Reportes" }] : []),
  ];

  const menuItems: Item[] = [
    { href: "/profile", label: "Perfil" },
    { href: "/sync", label: "Sincronización" },
    // GPS es tarea operativa de cualquier empleado (instalan/mueven los
    // dispositivos), pero poco frecuente — no amerita un lugar en la barra
    // principal, vive acá igual que Sincronización.
    { href: "/gps", label: "GPS" },
    // "Competencia" queda en el menú de cuenta (no en la barra principal) a
    // propósito, mientras se sigue puliendo — pasa a la barra principal más
    // adelante.
    ...(isAdmin
      ? [
          { href: "/competitor-prices", label: "Competencia" },
          { href: "/settings", label: "Configuración" },
        ]
      : []),
  ];

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <DesktopNav
        mainItems={mainItems}
        menuItems={menuItems}
        isActive={isActive}
        userName={userName}
        logout={logout}
        sync={sync}
        viewToggle={viewToggle}
      />
      <MobileNav
        mainItems={mainItems}
        menuItems={menuItems}
        isActive={isActive}
        userName={userName}
        logout={logout}
        sync={sync}
        viewToggle={viewToggle}
      />
    </>
  );
}
