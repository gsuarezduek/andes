"use client";

import { useState } from "react";
import { SyncButton, type SyncOutcome } from "@/components/nav/sync-button";
import type { Item } from "@/components/nav/types";

/** Botón hamburguesa + panel colapsable, visibles solo en mobile. */
export function MobileNav({
  mainItems,
  menuItems,
  isActive,
  userName,
  logout,
  sync,
  viewToggle,
}: {
  mainItems: Item[];
  menuItems: Item[];
  isActive: (href: string) => boolean;
  userName?: string | null;
  logout: () => void;
  sync?: () => Promise<SyncOutcome>;
  viewToggle?: { label: string; action: () => Promise<void>; active: boolean };
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile: ícono de sync (siempre visible) + botón hamburguesa */}
      <div className="ml-auto flex shrink-0 items-center gap-1 sm:hidden">
        {sync ? <SyncButton sync={sync} /> : null}
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-foreground/70 transition-colors hover:bg-foreground/5"
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
      </div>

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
                className={`flex items-center gap-2 rounded-lg px-3 py-3 text-base font-medium transition-colors ${
                  isActive(it.href)
                    ? "bg-foreground/10 text-foreground"
                    : "text-foreground/70 hover:bg-foreground/5"
                }`}
              >
                {it.label}
                {it.badge ? (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold leading-none text-white">
                    {it.badge}
                  </span>
                ) : null}
              </a>
            ))}

            <div className="my-1 border-t border-foreground/10" />
            {userName ? (
              <span className="flex items-center gap-2 px-3 pb-1 text-xs uppercase tracking-wide text-foreground/40">
                {userName}
                {viewToggle?.active ? (
                  <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-amber-700 dark:text-amber-400">
                    Vista empleado
                  </span>
                ) : null}
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

            {viewToggle ? (
              <>
                <div className="my-1 border-t border-foreground/10" />
                <form action={viewToggle.action}>
                  <button
                    type="submit"
                    className="w-full rounded-lg px-3 py-3 text-left text-base font-medium text-foreground/70 transition-colors hover:bg-foreground/5"
                  >
                    {viewToggle.label}
                  </button>
                </form>
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
