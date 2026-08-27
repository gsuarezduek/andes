import Link from "next/link";

const items = [
  { href: "/competitor-prices", label: "Comparación" },
  { href: "/competitor-prices/competitors", label: "Competidores" },
  { href: "/competitor-prices/categories", label: "Categorías" },
] as const;

/** Sub-navegación de la sección (3 vistas, cada una su propia página — no es TabBar porque son rutas reales, no estado en memoria). */
export function CompetitorPricesNav({ active }: { active: (typeof items)[number]["href"] }) {
  return (
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          aria-current={it.href === active ? "page" : undefined}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            it.href === active
              ? "bg-foreground text-background"
              : "border border-foreground/15 text-foreground/60 hover:border-foreground/30"
          }`}
        >
          {it.label}
        </Link>
      ))}
    </div>
  );
}
