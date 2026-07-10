import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { userRoleLabels } from "@/lib/labels";

export const metadata: Metadata = { title: "Usuarios — Andes" };

export default async function UsersPage() {
  await requireAdmin();

  const users = await prisma.user.findMany({ orderBy: { name: "asc" } });

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
    </div>
  );
}
