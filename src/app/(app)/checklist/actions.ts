"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";

export async function createChecklistItem(formData: FormData) {
  await requireAdmin();
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return;
  const max = await prisma.checklistItem.aggregate({ _max: { ordering: true } });
  await prisma.checklistItem.create({
    data: { label, ordering: (max._max.ordering ?? 0) + 1 },
  });
  revalidatePath("/checklist");
}

export async function toggleChecklistItem(id: string) {
  await requireAdmin();
  const item = await prisma.checklistItem.findUnique({ where: { id } });
  if (item) {
    await prisma.checklistItem.update({ where: { id }, data: { active: !item.active } });
  }
  revalidatePath("/checklist");
}

export async function deleteChecklistItem(id: string) {
  await requireAdmin();
  await prisma.checklistItem.delete({ where: { id } });
  revalidatePath("/checklist");
}

export async function moveChecklistItem(id: string, dir: "up" | "down") {
  await requireAdmin();
  const items = await prisma.checklistItem.findMany({ orderBy: { ordering: "asc" } });
  const idx = items.findIndex((i) => i.id === id);
  const swap = dir === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swap < 0 || swap >= items.length) return;
  const a = items[idx];
  const b = items[swap];
  await prisma.$transaction([
    prisma.checklistItem.update({ where: { id: a.id }, data: { ordering: b.ordering } }),
    prisma.checklistItem.update({ where: { id: b.id }, data: { ordering: a.ordering } }),
  ]);
  revalidatePath("/checklist");
}
