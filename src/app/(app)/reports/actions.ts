"use server";

import { requireAdmin } from "@/lib/auth-helpers";
import { sendMonthlyReportEmail, type MonthlyReportResult } from "@/lib/monthly-report-email";
import type { ReportPeriod } from "@/lib/reports";

/**
 * Botón "Generar informe (IA) y enviarlo por email" de /reports — solo
 * disponible para un mes ya cerrado (ver page.tsx). Devuelve el resultado
 * tipado para feedback inline (mismo patrón que `triggerSync`).
 */
export async function sendMonthlyReport(period: ReportPeriod): Promise<MonthlyReportResult> {
  await requireAdmin();
  return sendMonthlyReportEmail(period);
}
