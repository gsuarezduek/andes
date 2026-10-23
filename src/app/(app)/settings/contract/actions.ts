"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { displayName } from "@/lib/user-display";
import { defaultContractFields, normalizeContractInput, sameContract } from "@/lib/contract-text";

export type SaveContractState = { error?: string; unchanged?: boolean };

/**
 * Guarda una versión nueva de las condiciones generales. Nunca pisa la
 * anterior: las inspecciones ya firmadas apuntan a su versión y el acta
 * regenerada sale con ese texto. Si no cambió nada (contra la vigente, o
 * contra el texto original si todavía no hay ninguna), no crea versión.
 */
export async function saveContract(_prev: SaveContractState, formData: FormData): Promise<SaveContractState> {
  const user = await requireAdmin();
  const str = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v : "";
  };
  const parsed = normalizeContractInput({
    esTitle: str("esTitle"),
    esBody: str("esBody"),
    enTitle: str("enTitle"),
    enBody: str("enBody"),
  });
  if (!parsed.ok) return { error: parsed.error };

  const current = await prisma.contractVersion.findFirst({
    orderBy: { createdAt: "desc" },
    select: { esTitle: true, esBody: true, enTitle: true, enBody: true },
  });
  if (sameContract(parsed.value, current ?? defaultContractFields())) return { unchanged: true };

  await prisma.contractVersion.create({
    data: { ...parsed.value, createdById: user.id, createdByName: displayName(user) },
  });
  revalidatePath("/settings/contract");
  redirect("/settings/contract?saved=1");
}
