"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";

export async function createExpenseCategory(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const max = await prisma.cashMovementCategory.aggregate({ _max: { ordering: true } });
  await prisma.cashMovementCategory.create({
    data: { name, ordering: (max._max.ordering ?? 0) + 1 },
  });
  revalidatePath("/settings/expense-categories");
  revalidatePath("/caja");
}

export async function toggleExpenseCategory(id: string) {
  await requireAdmin();
  const item = await prisma.cashMovementCategory.findUnique({ where: { id } });
  if (item) {
    await prisma.cashMovementCategory.update({ where: { id }, data: { active: !item.active } });
  }
  revalidatePath("/settings/expense-categories");
  revalidatePath("/caja");
}

// Borrado real (no soft-delete): `CashMovement.categoryId` es una FK opcional
// sin `onDelete: Restrict`, así que Postgres la deja en null y `categoryName`
// (el snapshot ya guardado) sigue mostrando el nombre — mismo criterio que
// `deletePaymentMethod`.
export async function deleteExpenseCategory(id: string) {
  await requireAdmin();
  await prisma.cashMovementCategory.delete({ where: { id } });
  revalidatePath("/settings/expense-categories");
  revalidatePath("/caja");
}

export async function moveExpenseCategory(id: string, dir: "up" | "down") {
  await requireAdmin();
  const items = await prisma.cashMovementCategory.findMany({ orderBy: { ordering: "asc" } });
  const idx = items.findIndex((i) => i.id === id);
  const swap = dir === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swap < 0 || swap >= items.length) return;
  const a = items[idx];
  const b = items[swap];
  await prisma.$transaction([
    prisma.cashMovementCategory.update({ where: { id: a.id }, data: { ordering: b.ordering } }),
    prisma.cashMovementCategory.update({ where: { id: b.id }, data: { ordering: a.ordering } }),
  ]);
  revalidatePath("/settings/expense-categories");
}
