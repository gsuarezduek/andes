import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { compactControlClass } from "@/components/ui/fields";
import { userRoleLabels, loginDeviceLabels } from "@/lib/labels";
import { formatDateTime } from "@/lib/datetime";

export const metadata: Metadata = { title: "Usuarios — Andes" };

const LOGIN_EVENTS_LIMIT = 200;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ loginUser?: string }>;
}) {
  await requireAdmin();
  const { loginUser } = await searchParams;

  const [users, loginEvents] = await Promise.all([
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    prisma.loginEvent.findMany({
      where: loginUser ? { userId: loginUser } : undefined,
      orderBy: { createdAt: "desc" },
      take: LOGIN_EVENTS_LIMIT,
      include: { user: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usuarios</h1>
          <p className="text-sm text-foreground/60">{users.length} en total</p>
        </div>
        <ButtonLink href="/users/new">Nuevo</ButtonLink>
      </div>

      <ul className="flex flex-col divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
        {users.map((u) => (
          <li key={u.id}>
            <Link
              href={`/users/${u.id}/edit`}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-foreground/[0.03]"
            >
              <div className="flex-1">
                <p className="font-medium">{u.name}</p>
                <p className="text-sm text-foreground/60">{u.email}</p>
              </div>
              {!u.active ? <Badge tone="red">Inactivo</Badge> : null}
              <Badge tone={u.role === "admin" ? "blue" : "neutral"}>
                {userRoleLabels[u.role]}
              </Badge>
            </Link>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Historial de logins</h2>
          <form className="flex items-center gap-2">
            <select
              name="loginUser"
              defaultValue={loginUser ?? ""}
              className={compactControlClass}
            >
              <option value="">Todos los usuarios</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <button className="h-10 rounded-lg border border-foreground/15 px-4 text-sm font-medium">
              Filtrar
            </button>
            {loginUser ? (
              <Link href="/users" className="text-xs font-medium text-foreground/60 underline">
                Limpiar
              </Link>
            ) : null}
          </form>
        </div>

        {loginEvents.length === 0 ? (
          <p className="text-sm text-foreground/60">Sin logins registrados.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
            {loginEvents.map((ev) => (
              <li key={ev.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1">
                  <p className="font-medium">{ev.user.name}</p>
                  <p className="text-sm text-foreground/60">{formatDateTime(ev.createdAt)}</p>
                </div>
                <Badge tone={ev.device === "mobile" ? "blue" : "neutral"}>
                  {loginDeviceLabels[ev.device]}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ButtonLink href="/settings" variant="secondary">Volver a Configuración</ButtonLink>
    </div>
  );
}
