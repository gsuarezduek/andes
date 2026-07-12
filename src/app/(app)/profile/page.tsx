import type { Metadata } from "next";
import { requireUser } from "@/lib/auth-helpers";
import { Badge } from "@/components/ui/badge";
import { userRoleLabels } from "@/lib/labels";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Perfil — Andes" };

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
      <span className="text-foreground/60">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export default async function ProfilePage() {
  const user = await requireUser();
  const role = user.role as keyof typeof userRoleLabels;

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Perfil</h1>
        <p className="text-sm text-foreground/60">Tu cuenta y contraseña.</p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Datos</h2>
        <div className="divide-y divide-foreground/10 rounded-xl border border-foreground/10">
          <Row label="Nombre" value={user.name ?? "—"} />
          <Row label="Email" value={user.email ?? "—"} />
          <Row label="Rol" value={<Badge tone="neutral">{userRoleLabels[role] ?? role}</Badge>} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Cambiar contraseña</h2>
        <PasswordForm />
      </section>
    </div>
  );
}
