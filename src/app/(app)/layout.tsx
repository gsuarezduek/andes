import Image from "next/image";
import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";
import { NavLink } from "@/components/nav-link";
import { logout } from "./actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const isAdmin = user.role === "admin";

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-foreground/10 bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/icon.svg" alt="Andes" width={32} height={32} className="rounded-lg" />
            <span className="text-base font-bold tracking-tight">Andes</span>
          </Link>

          <nav className="ml-2 flex flex-1 items-center gap-1 overflow-x-auto">
            <NavLink href="/">Inicio</NavLink>
            <NavLink href="/rentals">Alquileres</NavLink>
            <NavLink href="/vehicles">Vehículos</NavLink>
            {isAdmin ? <NavLink href="/users">Usuarios</NavLink> : null}
            {isAdmin ? <NavLink href="/checklist">Checklist</NavLink> : null}
          </nav>

          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden text-sm text-foreground/60 sm:inline">
              {user.name}
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-lg px-3 py-2 text-sm font-medium text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
              >
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
