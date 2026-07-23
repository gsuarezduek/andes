"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { runBookingSync, seedFleetFromWp } from "@/lib/sync/engine";

/** Corre la sincronización manualmente (botón "Sincronizar ahora"). */
export async function triggerSync() {
  await requireUser();
  await runBookingSync();
  revalidatePath("/sync");
}

/** Seed inicial de la flota desde wp_vikrentcar_cars (crea las unidades faltantes
 *  y reactiva las archivadas cuyo modelo volvió a estar disponible). */
export async function triggerFleetSeed() {
  await requireUser();
  const result = await seedFleetFromWp();
  revalidatePath("/sync");
  revalidatePath("/vehicles");
  redirect(`/sync?flota=${result.created}-${result.reactivated}`);
}
