"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { NavLink } from "@/components/nav-link";

type Item = { href: string; label: string };

/** Botón-ícono para disparar la sincronización con VikRentCar a mano. */
function SyncButton({ sync, full = false }: { sync: () => Promise<void>; full?: boolean }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const router = useRouter();
  const run = () =>
    start(async () => {
      setDone(false);
      try {
        await sync();
        setDone(true);
        router.refresh();
      } catch {
        /* sin feedback de error acá; el detalle está en /sync */
      }
    });

  if (full) {
    return (
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-base font-medium text-foreground/70 transition-colors hover:bg-foreground/5 disabled:opacity-60"
      >
        <SyncIcon spinning={pending} done={done} />
        {pending ? "Sincronizando…" : done ? "Sincronizado ✓" : "Sincronizar ahora"}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      title={pending ? "Sincronizando…" : done ? "Sincronizado" : "Sincronizar ahora"}
      aria-label="Sincronizar ahora"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground disabled:opacity-60"
    >
      <SyncIcon spinning={pending} done={done} />
    </button>
  );
}

function SyncIcon({ spinning, done }: { spinning: boolean; done: boolean }) {
  if (done && !spinning) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-emerald-600">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={spinning ? "animate-spin" : ""}>
      <path d="M21 12a9 9 0 0 1-9 9c-2.5 0-4.8-1-6.4-2.7" />
      <path d="M3 12a9 9 0 0 1 9-9c2.5 0 4.8 1 6.4 2.7" />
      <polyline points="21 3 21 8 16 8" />
      <polyline points="3 21 3 16 8 16" />
    </svg>
  );
}

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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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
