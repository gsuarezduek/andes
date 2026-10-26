import Link from "next/link";

/**
 * Link del menú principal de desktop. El estado activo lo decide el caller
 * (`DesktopNav`, vía la misma `isActive` que ya usa el menú de cuenta) — antes
 * este componente calculaba el suyo por separado con `usePathname()`, así que
 * páginas que viven "dentro" de otro ítem del menú (ej. `/gps` dentro de
 * Vehículos, `/horarios` dentro de Tareas) no resaltaban el ítem padre en la
 * barra de desktop aunque sí lo hacían en mobile (que ya usaba `isActive`).
 */
export function NavLink({
  href,
  active,
  children,
  badge,
}: {
  href: string;
  active: boolean;
  children: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-foreground/10 text-foreground"
          : "text-foreground/60 hover:bg-foreground/5 hover:text-foreground"
      }`}
    >
      {children}
      {badge ? (
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
