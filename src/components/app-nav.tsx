"use client";

import { usePathname } from "next/navigation";
import { DesktopNav } from "@/components/nav/desktop-nav";
import { MobileNav } from "@/components/nav/mobile-nav";
import type { SyncOutcome } from "@/components/nav/sync-button";
import type { Item } from "@/components/nav/types";

/**
 * Navegación de la app.
 *
 * - Menú principal (siempre visible en desktop): Alquileres, Calendario, Vehículos, Caja,
 *   y para admin además Reportes y Configuración — antes vivían enterrados en el submenú
 *   de cuenta, tan frecuentes para un admin como el resto de la barra principal. Usuarios
 *   vive dentro de Configuración (`/users`, un ítem más de esa pantalla), no en la barra.
 * - Submenú de cuenta (desplegable a la derecha, donde estaba "Salir"):
 *   Perfil, Sincronización y Salir — ajustes personales, no navegación operativa.
 * - En mobile todo colapsa en un menú hamburguesa.
 */
export function AppNav({
  isAdmin,
  userName,
  logout,
  sync,
}: {
  isAdmin: boolean;
  userName?: string | null;
  logout: () => void;
  sync?: () => Promise<SyncOutcome>;
}) {
  const pathname = usePathname();

  const mainItems: Item[] = [
    { href: "/rentals", label: "Alquileres" },
    { href: "/calendar", label: "Calendario" },
    { href: "/vehicles", label: "Vehículos" },
    { href: "/caja", label: "Caja" },
    ...(isAdmin
      ? [
          { href: "/reports", label: "Reportes" },
          { href: "/settings", label: "Configuración" },
        ]
      : []),
  ];

  const menuItems: Item[] = [
    { href: "/profile", label: "Perfil" },
    { href: "/sync", label: "Sincronización" },
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
      />
      <MobileNav
        mainItems={mainItems}
        menuItems={menuItems}
        isActive={isActive}
        userName={userName}
        logout={logout}
        sync={sync}
      />
    </>
  );
}
