import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";

const cards = [
  {
    href: "/rentals",
    title: "Alquileres",
    desc: "Reservas y alquileres manuales. Iniciar entrega/devolución (próximas fases).",
  },
  {
    href: "/vehicles",
    title: "Vehículos",
    desc: "Flota: estado, kilometraje y perfil de cada auto.",
  },
  {
    href: "/users",
    title: "Usuarios",
    desc: "Alta y gestión de empleados y administradores.",
    adminOnly: true,
  },
];

export default async function HomePage() {
  const user = await requireUser();
  const isAdmin = user.role === "admin";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Hola, {user.name?.split(" ")[0] ?? "equipo"}
        </h1>
        <p className="text-sm text-foreground/60">
          Panel interno de entregas y devoluciones.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {cards
          .filter((c) => !c.adminOnly || isAdmin)
          .map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="rounded-xl border border-foreground/10 p-4 transition-colors hover:border-foreground/25 hover:bg-foreground/[0.03]"
            >
              <h2 className="text-base font-semibold">{c.title}</h2>
              <p className="mt-1 text-sm text-foreground/60">{c.desc}</p>
            </Link>
          ))}
      </div>
    </div>
  );
}
