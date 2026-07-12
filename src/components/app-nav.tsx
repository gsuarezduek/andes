"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { NavLink } from "@/components/nav-link";

type Item = { href: string; label: string };

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
}: {
  isAdmin: boolean;
  userName?: string | null;
  logout: () => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  const mainItems: Item[] = [
    { href: "/rentals", label: "Alquileres" },
    { href: "/vehicles", label: "Vehículos" },
  ];

  const menuItems: Item[] = [
    { href: "/profile", label: "Perfil" },
    { href: "/sync", label: "Sincronización" },
    ...(isAdmin
      ? [
          { href: "/users", label: "Usuarios" },
          { href: "/settings", label: "Configuración" },
        ]
      : []),
  ];

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      {/* Desktop: menú principal inline */}
      <nav className="ml-2 hidden flex-1 items-center gap-1 sm:flex">
        {mainItems.map((it) => (
          <NavLink key={it.href} href={it.href}>
            {it.label}
          </NavLink>
        ))}
      </nav>

      {/* Desktop: submenú de cuenta (desplegable) */}
      <div className="relative hidden shrink-0 items-center sm:flex">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          <span>{userName || "Cuenta"}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`transition-transform ${menuOpen ? "rotate-180" : ""}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {menuOpen ? (
          <>
            {/* Backdrop para cerrar al hacer click afuera */}
            <button
              type="button"
              aria-hidden="true"
              tabIndex={-1}
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-10 cursor-default"
            />
            <div
              role="menu"
              className="absolute right-0 top-full z-20 mt-1 w-52 overflow-hidden rounded-xl border border-foreground/10 bg-background py-1 shadow-lg"
            >
              {menuItems.map((it) => (
                <a
                  key={it.href}
                  href={it.href}
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  aria-current={isActive(it.href) ? "page" : undefined}
                  className={`block px-4 py-2.5 text-sm transition-colors ${
                    isActive(it.href)
                      ? "bg-foreground/10 font-medium text-foreground"
                      : "text-foreground/70 hover:bg-foreground/5"
                  }`}
                >
                  {it.label}
                </a>
              ))}
              <div className="my-1 border-t border-foreground/10" />
              <form action={logout}>
                <button
                  type="submit"
                  role="menuitem"
                  className="block w-full px-4 py-2.5 text-left text-sm text-foreground/70 transition-colors hover:bg-foreground/5"
                >
                  Salir
                </button>
              </form>
            </div>
          </>
        ) : null}
      </div>

      {/* Mobile: botón hamburguesa */}
      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        aria-expanded={mobileOpen}
        aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
        className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-foreground/70 transition-colors hover:bg-foreground/5 sm:hidden"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          {mobileOpen ? (
            <>
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </>
          ) : (
            <>
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </>
          )}
        </svg>
      </button>

      {/* Mobile: panel desplegable */}
      {mobileOpen ? (
        <div className="absolute inset-x-0 top-full border-b border-foreground/10 bg-background shadow-lg sm:hidden">
          <nav className="mx-auto flex w-full max-w-5xl flex-col gap-1 px-4 py-3">
            {mainItems.map((it) => (
              <a
                key={it.href}
                href={it.href}
                onClick={() => setMobileOpen(false)}
                aria-current={isActive(it.href) ? "page" : undefined}
                className={`rounded-lg px-3 py-3 text-base font-medium transition-colors ${
                  isActive(it.href)
                    ? "bg-foreground/10 text-foreground"
                    : "text-foreground/70 hover:bg-foreground/5"
                }`}
              >
                {it.label}
              </a>
            ))}

            <div className="my-1 border-t border-foreground/10" />
            {userName ? (
              <span className="px-3 pb-1 text-xs uppercase tracking-wide text-foreground/40">
                {userName}
              </span>
            ) : null}
            {menuItems.map((it) => (
              <a
                key={it.href}
                href={it.href}
                onClick={() => setMobileOpen(false)}
                aria-current={isActive(it.href) ? "page" : undefined}
                className={`rounded-lg px-3 py-3 text-base font-medium transition-colors ${
                  isActive(it.href)
                    ? "bg-foreground/10 text-foreground"
                    : "text-foreground/70 hover:bg-foreground/5"
                }`}
              >
                {it.label}
              </a>
            ))}

            <div className="my-1 border-t border-foreground/10" />
            <form action={logout}>
              <button
                type="submit"
                className="w-full rounded-lg px-3 py-3 text-left text-base font-medium text-foreground/70 transition-colors hover:bg-foreground/5"
              >
                Salir
              </button>
            </form>
          </nav>
        </div>
      ) : null}
    </>
  );
}
