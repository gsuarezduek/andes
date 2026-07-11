"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { NavLink } from "@/components/nav-link";

type Item = { href: string; label: string };

/**
 * Navegación de la app. En desktop se muestra inline; en mobile colapsa en un
 * menú hamburguesa que despliega los links y el botón de salir.
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
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const items: Item[] = [
    { href: "/", label: "Inicio" },
    { href: "/rentals", label: "Alquileres" },
    { href: "/vehicles", label: "Vehículos" },
    ...(isAdmin
      ? [
          { href: "/users", label: "Usuarios" },
          { href: "/checklist", label: "Checklist" },
        ]
      : []),
  ];

  return (
    <>
      {/* Desktop: nav inline */}
      <nav className="ml-2 hidden flex-1 items-center gap-1 sm:flex">
        {items.map((it) => (
          <NavLink key={it.href} href={it.href}>
            {it.label}
          </NavLink>
        ))}
      </nav>

      <div className="hidden shrink-0 items-center gap-3 sm:flex">
        {userName ? (
          <span className="text-sm text-foreground/60">{userName}</span>
        ) : null}
        <form action={logout}>
          <button
            type="submit"
            className="rounded-lg px-3 py-2 text-sm font-medium text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
          >
            Salir
          </button>
        </form>
      </div>

      {/* Mobile: botón hamburguesa */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-foreground/70 transition-colors hover:bg-foreground/5 sm:hidden"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          {open ? (
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
      {open ? (
        <div className="absolute inset-x-0 top-full border-b border-foreground/10 bg-background shadow-lg sm:hidden">
          <nav className="mx-auto flex w-full max-w-5xl flex-col gap-1 px-4 py-3">
            {items.map((it) => {
              const active = it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
              return (
                <a
                  key={it.href}
                  href={it.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-lg px-3 py-3 text-base font-medium transition-colors ${
                    active
                      ? "bg-foreground/10 text-foreground"
                      : "text-foreground/70 hover:bg-foreground/5"
                  }`}
                >
                  {it.label}
                </a>
              );
            })}
            <div className="mt-2 flex items-center justify-between border-t border-foreground/10 pt-3">
              {userName ? (
                <span className="px-3 text-sm text-foreground/60">{userName}</span>
              ) : <span />}
              <form action={logout}>
                <button
                  type="submit"
                  className="rounded-lg px-3 py-2 text-sm font-medium text-foreground/70 transition-colors hover:bg-foreground/5"
                >
                  Salir
                </button>
              </form>
            </div>
          </nav>
        </div>
      ) : null}
    </>
  );
}
