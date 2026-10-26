import Link from "next/link";

/** Alterna entre Tareas, Horarios y Accesos (mismo lugar del menú, tres pantallas de equipo). */
export function TeamTabs({ active }: { active: "tasks" | "schedule" | "access" }) {
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
      {tab("/tasks", "Tareas", active === "tasks")}
      {tab("/horarios", "Horarios", active === "schedule")}
      {tab("/access", "Accesos", active === "access")}
    </div>
  );
}
