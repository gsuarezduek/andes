"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, requireAdmin } from "@/lib/auth-helpers";
import { runBookingSync, type SyncSummary } from "@/lib/sync/engine";
import { seedFleetFromWp } from "@/lib/sync/fleet-seed";
import { sendDailySummaryEmail } from "@/lib/daily-summary";

/**
 * Corre la sincronización manualmente (botón "Sincronizar ahora"). Devuelve
 * el resultado (antes se descartaba: el botón del header mostraba el mismo
 * ✓ verde aunque `runBookingSync` hubiera vuelto con result:"error").
 */
export async function triggerSync(): Promise<Pick<SyncSummary, "result" | "message">> {
  await requireUser();
  const { result, message } = await runBookingSync();
  revalidatePath("/sync");
  return { result, message };
}

/** Misma sincronización, para el `<form action>` de /sync (ignora el resultado — el feedback ahí sale de la lista de `sync_logs`, ya recargada por `revalidatePath`). */
export async function triggerSyncForm(): Promise<void> {
  await triggerSync();
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

/**
 * Botón "Enviar ahora" del resumen diario (admin): dispara el mismo envío
 * que el cron de Railway llamaría todos los días, autenticado por sesión en
 * vez de CRON_SECRET (mismo criterio que `triggerSync` vs `/api/sync`). Útil
 * también para probar sin depender de que el cron ya esté configurado.
 */
export async function triggerDailySummaryForm(): Promise<void> {
  await requireAdmin();
  const result = await sendDailySummaryEmail();
  const status = result.sent ? "enviado" : result.reason;
  redirect(`/sync?resumen=${status}`);
}
