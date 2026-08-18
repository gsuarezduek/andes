"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, requireAdmin } from "@/lib/auth-helpers";
import { runBookingSync, type SyncSummary } from "@/lib/sync/engine";
import { seedFleetFromWp } from "@/lib/sync/fleet-seed";
import { importBookingPayment } from "@/lib/sync/booking-upsert";
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
 * Backfill de señas ya sincronizadas antes de que existiera el import
 * automático a Caja (ver `importBookingPayment`, sync/booking-upsert.ts):
 * recorre las reservas `reserved` con `bookingPaid` mayor a lo ya importado y
 * crea el ingreso pendiente. Idempotente — correrlo de nuevo no duplica nada
 * (solo importa la diferencia contra `bookingPaidImportedAmount`).
 */
export async function triggerBookingPaymentBackfill(): Promise<void> {
  await requireAdmin();
  const rentals = await prisma.rental.findMany({
    where: { status: "reserved", bookingPaid: { not: null } },
    select: {
      id: true,
      bookingPaid: true,
      bookingPaidImportedAmount: true,
      bookingPaymentMethod: true,
      wpBookingId: true,
      clientName: true,
    },
  });

  let count = 0;
  for (const r of rentals) {
    const paid = r.bookingPaid ? Number(r.bookingPaid) : 0;
    const imported = r.bookingPaidImportedAmount ? Number(r.bookingPaidImportedAmount) : 0;
    if (paid > imported + 0.01) {
      await importBookingPayment(r.id, imported, paid, r.bookingPaymentMethod, r.wpBookingId, r.clientName);
      count++;
    }
  }

  revalidatePath("/sync");
  revalidatePath("/caja");
  redirect(`/sync?senas=${count}`);
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
