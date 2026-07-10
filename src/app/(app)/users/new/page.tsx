import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-helpers";
import { UserForm } from "../user-form";
import { createUser } from "../actions";

export const metadata: Metadata = { title: "Nuevo usuario — Andes" };

export default async function NewUserPage() {
  await requireAdmin();

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <h1 className="text-2xl font-bold tracking-tight">Nuevo usuario</h1>
      <UserForm action={createUser} />
    </div>
  );
}
