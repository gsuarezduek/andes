import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-helpers";

export const metadata: Metadata = { title: "Configuración — Andes" };

const options: { href: string; title: string; description: string }[] = [
  {
    href: "/settings/general",
    title: "Condiciones y checklist",
    description: "Condiciones económicas precargadas y checklist de entrega/devolución.",
  },
  {
    href: "/settings/calendar",
    title: "Calendario",
    description: "Orden de los autos y ajustes de la vista de calendario.",
  },
  {
    href: "/settings/emails",
    title: "Correos electrónicos",
    description: "Textos de los correos al cliente y casilla desde donde se envían.",
  },
];

export default async function SettingsPage() {
  await requireAdmin();

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-sm text-foreground/60">Ajustes generales de la aplicación.</p>
      </div>

      <ul className="flex flex-col divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
        {options.map((o) => (
          <li key={o.href}>
            <Link
              href={o.href}
              className="flex items-center justify-between gap-3 px-4 py-4 transition-colors hover:bg-foreground/[0.03]"
            >
              <div>
                <p className="font-medium">{o.title}</p>
                <p className="text-sm text-foreground/60">{o.description}</p>
              </div>
              <span aria-hidden="true" className="text-foreground/40">›</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
