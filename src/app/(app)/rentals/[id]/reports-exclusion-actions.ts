"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { displayName } from "@/lib/user-display";

/**
 * Excluye (o vuelve a incluir) una reserva de las métricas de Reportes
 * (solo admin). No toca la reserva, sus inspecciones firmadas ni Caja — solo
 * deja de contar en lo derivado de alquileres. Exige un motivo al excluir, así
 * queda claro después por qué falta.
 */
export async function setReportsExclusion(
  rentalId: string,
  exclude: boolean,
  reason: string,
): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  const trimmed = reason.trim();
  if (exclude && trimmed.length < 3) return { error: "Escribí el motivo de la exclusión." };

  const { count } = await prisma.rental.updateMany({
    where: { id: rentalId },
    data: exclude
      ? { reportsExcludedAt: new Date(), reportsExcludedReason: trimmed, reportsExcludedByName: displayName(admin) }
      : { reportsExcludedAt: null, reportsExcludedReason: null, reportsExcludedByName: null },
  });
  if (count === 0) return { error: "La reserva no existe." };

  revalidatePath(`/rentals/${rentalId}`);
  // Reportes está cacheado 60 s (ver getReports); acá el admin espera ver el efecto ya.
  revalidateTag("reports", "max");
  return {};
}
