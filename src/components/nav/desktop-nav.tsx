"use client";

import { useState } from "react";
import { NavLink } from "@/components/nav-link";
import { SyncButton } from "@/components/nav/sync-button";
import type { Item } from "@/components/nav/types";

/** Menú principal inline + submenú de cuenta desplegable, visibles solo en desktop. */
export function DesktopNav({
  mainItems,
  menuItems,
  isActive,
  userName,
  logout,
  sync,
}: {
  mainItems: Item[];
  menuItems: Item[];
  isActive: (href: string) => boolean;
  userName?: string | null;
  logout: () => void;
  sync?: () => Promise<void>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

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
      <div className="relative hidden shrink-0 items-center gap-1 sm:flex">
        {sync ? <SyncButton sync={sync} /> : null}
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
    </>
  );
}
