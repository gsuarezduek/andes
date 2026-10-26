"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { DesktopNav } from "@/components/nav/desktop-nav";
import { MobileNav } from "@/components/nav/mobile-nav";
import { CommandPalette } from "@/components/nav/command-palette";
import type { SyncOutcome } from "@/components/nav/sync-button";
import type { Item } from "@/components/nav/types";
import type { OnlineUser } from "@/lib/presence";

/**
 * Navegación de la app.
 *
 * - Menú principal (siempre visible en desktop): Alquileres, WhatsApp, Calendario, Vehículos,
 *   Caja, Tareas, y para admin además Reportes — antes vivía enterrado en el submenú de cuenta, tan
 *   frecuente para un admin como el resto de la barra principal. Usuarios vive dentro de
 *   Configuración (`/users`, un ítem más de esa pantalla), no en la barra. Tareas muestra un
 *   contador rojo con las tareas pendientes asignadas al usuario logueado (`taskCount`).
 *   **Vehículos** agrupa, además de la flota propia, Terceros/Permisos/GPS/Habitaciones —
 *   pestañas dentro de la página (`FleetTabs`), mismo ítem de la barra. **Tareas** agrupa del
 *   mismo modo Horarios y Accesos (`TeamTabs`).
 * - Submenú de cuenta (desplegable a la derecha, donde estaba "Salir"):
 *   Perfil, Sincronización, Configuración (solo admin), "Ver como empleado"
 *   (solo si `isRealAdmin` — deja probar la vista de un usuario normal sin salir
 *   de la sesión de admin) y Salir — ajustes/administración menos frecuentes que
 *   la navegación operativa de la barra principal. "Competencia" se saca del todo del menú
 *   (sin ocultar la ruta/feature) mientras se sigue puliendo — ver `/competitor-prices`.
 * - En mobile todo colapsa en un menú hamburguesa.
 * - Paleta de comandos (Ctrl/⌘ + K, o la lupa del header) para saltar a cualquier sección.
 */
export function AppNav({
  isAdmin,
  userName,
  logout,
  sync,
  taskCount,
  whatsappUnread,
  onlineUsers,
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
  /** Usuarios activos ahora mismo (incluido quien mira, últimos ~15 min) — quién está conectado, sin preguntar. */
  onlineUsers?: OnlineUser[];
  /** Rol real de la sesión (no el efectivo tras "Ver como empleado"). */
  isRealAdmin?: boolean;
  viewingAsEmployee?: boolean;
  enableEmployeeView?: () => Promise<void>;
  disableEmployeeView?: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
    // GPS, Horarios y Accesos pasaron a vivir dentro de Vehículos/Tareas
    // (pestañas, ver FleetTabs/TeamTabs) — ya no están sueltos acá.
    // "Competencia" se saca del menú (sin tocar la ruta/feature) mientras se
    // sigue puliendo — no se logró dejarla bien todavía.
    ...(isAdmin ? [{ href: "/settings", label: "Configuración" }] : []),
  ];

  // Terceros, Permisos, GPS y Habitaciones viven dentro de Vehículos (mismo
  // ítem del menú, pestañas de FleetTabs); Horarios y Accesos viven dentro de
  // Tareas (pestañas de TeamTabs).
  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : href === "/vehicles"
        ? pathname.startsWith("/vehicles") ||
          pathname.startsWith("/third-party-vehicles") ||
          pathname.startsWith("/permits") ||
          pathname.startsWith("/gps") ||
          pathname.startsWith("/rooms")
        : href === "/tasks"
          ? pathname.startsWith("/tasks") || pathname.startsWith("/horarios") || pathname.startsWith("/access")
          : pathname.startsWith(href);

  return (
    <>
      <DesktopNav
        mainItems={mainItems}
        menuItems={menuItems}
        isActive={isActive}
        userName={userName}
        logout={logout}
        sync={sync}
        onlineUsers={onlineUsers}
        viewToggle={viewToggle}
        onOpenPalette={() => setPaletteOpen(true)}
      />
      <MobileNav
        mainItems={mainItems}
        menuItems={menuItems}
        isActive={isActive}
        userName={userName}
        logout={logout}
        sync={sync}
        onlineUsers={onlineUsers}
        viewToggle={viewToggle}
        onOpenPalette={() => setPaletteOpen(true)}
      />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} isAdmin={isAdmin} />
    </>
  );
}
