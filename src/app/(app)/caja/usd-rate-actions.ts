"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { displayName } from "@/lib/user-display";

const schema = z.object({ rate: z.coerce.number().positive().max(1_000_000) });

/**
 * Carga un valor de referencia nuevo del USD (pesos por 1 USD). Solo admin.
 * Agrega una fila al historial — nunca pisa la anterior, así los movimientos
 * ya cargados se siguen convirtiendo con el valor que regía en su momento.
 */
export async function setUsdRate(formData: FormData) {
  const user = await requireAdmin();
  const { rate } = schema.parse({ rate: formData.get("rate") });

  await prisma.usdRate.create({ data: { rate, createdByName: displayName(user) } });

  revalidatePath("/caja");
  revalidatePath("/reports");
  // Reportes está cacheado 60s (ver `getReports`): sin esto el cambio tardaría en verse.
  revalidateTag("reports", "max");
}
