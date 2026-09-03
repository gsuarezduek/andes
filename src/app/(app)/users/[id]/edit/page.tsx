import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { UserForm } from "../../user-form";
import { UserDeleteButton } from "../../user-delete-button";
import { updateUser } from "../../actions";

export const metadata: Metadata = { title: "Editar usuario — Andes" };

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = await requireAdmin();

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) notFound();

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <h1 className="text-2xl font-bold tracking-tight">Editar usuario</h1>
      <UserForm action={updateUser.bind(null, id)} user={user} />
      {user.id !== admin.id && (
        <UserDeleteButton userId={user.id} name={user.name} active={user.active} />
      )}
    </div>
  );
}
