import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-helpers";
import { getActorPerm } from "@/lib/user-access";
import { UserForm } from "../user-form";
import { createUser } from "../actions";

export const metadata: Metadata = { title: "Nuevo usuario — Andes" };

export default async function NewUserPage() {
  const admin = await requireAdmin();
  const actor = await getActorPerm(admin);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <h1 className="text-2xl font-bold tracking-tight">Nuevo usuario</h1>
      <UserForm action={createUser} canGrantElevated={actor?.owner ?? false} />
    </div>
  );
}
