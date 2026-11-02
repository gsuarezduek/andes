"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { displayName } from "@/lib/user-display";
import { normalizeOwnerContractText, ORIGINAL_OWNER_CONTRACT_TEXT } from "@/lib/owner-contract";

export type SaveOwnerContractTextState = { error?: string; unchanged?: boolean };

/**
 * Guarda una versión nueva de las cláusulas. Nunca pisa la anterior: los
 * contratos ya firmados apuntan a su versión y su PDF sale siempre con ese texto.
 */
export async function saveOwnerContractText(
  _prev: SaveOwnerContractTextState,
  formData: FormData,
): Promise<SaveOwnerContractTextState> {
  const user = await requireAdmin();
  const parsed = normalizeOwnerContractText({
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? ""),
  });
  if (!parsed.ok) return { error: parsed.error };

  const current =
    (await prisma.ownerContractVersion.findFirst({ orderBy: { createdAt: "desc" }, select: { title: true, body: true } })) ??
    ORIGINAL_OWNER_CONTRACT_TEXT;
  if (current.title === parsed.value.title && current.body === parsed.value.body) return { unchanged: true };

  await prisma.ownerContractVersion.create({
    data: { ...parsed.value, createdById: user.id, createdByName: displayName(user) },
  });
  revalidatePath("/settings/owner-contract");
  redirect("/settings/owner-contract?saved=1");
}
