"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-helpers";
import { runBookingSync, seedFleetFromWp } from "@/lib/sync/engine";

/** Corre la sincronización manualmente (botón "Sincronizar ahora"). */
export async function triggerSync() {
  await requireUser();
  await runBookingSync();
  revalidatePath("/sync");
}

/** Seed inicial de la flota desde wp_vikrentcar_cars (crea las unidades faltantes). */
export async function triggerFleetSeed() {
  await requireUser();
  await seedFleetFromWp();
  revalidatePath("/sync");
  revalidatePath("/vehicles");
}
