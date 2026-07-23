"use client";

import { useState } from "react";
import { SyncButton } from "@/components/nav/sync-button";
import type { Item } from "@/components/nav/types";

/** Botón hamburguesa + panel colapsable, visibles solo en mobile. */
export function MobileNav({
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
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
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

            {sync ? (
              <>
                <div className="my-1 border-t border-foreground/10" />
                <SyncButton sync={sync} full />
              </>
            ) : null}

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
