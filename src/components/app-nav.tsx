"use client";

import { usePathname } from "next/navigation";
import { DesktopNav } from "@/components/nav/desktop-nav";
import { MobileNav } from "@/components/nav/mobile-nav";
import type { Item } from "@/components/nav/types";

/**
 * Navegación de la app.
 *
 * - Menú principal (siempre visible en desktop): Alquileres, Vehículos.
 * - Submenú de cuenta (desplegable a la derecha, donde estaba "Salir"):
 *   Perfil, Sincronización, [Usuarios, Configuración si es admin] y Salir.
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
  sync?: () => Promise<void>;
}) {
  const pathname = usePathname();

  const mainItems: Item[] = [
    { href: "/rentals", label: "Alquileres" },
    { href: "/calendar", label: "Calendario" },
    { href: "/vehicles", label: "Vehículos" },
  ];

  const menuItems: Item[] = [
    { href: "/profile", label: "Perfil" },
    { href: "/sync", label: "Sincronización" },
    ...(isAdmin
      ? [
          { href: "/reports", label: "Reportes" },
          { href: "/users", label: "Usuarios" },
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
