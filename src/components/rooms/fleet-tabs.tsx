import Link from "next/link";

/** Alterna entre Vehículos y Habitaciones (mismo lugar del menú, dos listados). */
export function FleetTabs({ active }: { active: "vehicles" | "rooms" }) {
  const tab = (href: string, label: string, isActive: boolean) => (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        isActive ? "bg-foreground text-background" : "text-foreground/60 hover:bg-foreground/5"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <div className="inline-flex w-fit gap-1 rounded-lg border border-foreground/15 p-1">
      {tab("/vehicles", "Vehículos", active === "vehicles")}
      {tab("/rooms", "Habitaciones", active === "rooms")}
    </div>
  );
}
