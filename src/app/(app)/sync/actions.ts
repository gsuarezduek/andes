"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-helpers";
import { runBookingSync, seedFleetFromWp } from "@/lib/sync/engine";

/** Corre la sincronización manualmente (botón "Sincronizar ahora" del admin). */
export async function triggerSync() {
  await requireAdmin();
  await runBookingSync();
  revalidatePath("/sync");
}

/** Seed inicial de la flota desde wp_vikrentcar_cars (crea las unidades faltantes). */
export async function triggerFleetSeed() {
  await requireAdmin();
  await seedFleetFromWp();
  revalidatePath("/sync");
  revalidatePath("/vehicles");
}
