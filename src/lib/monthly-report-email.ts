import "server-only";
import { env } from "@/lib/env";
import { formatArs } from "@/lib/contract";
import { formatDuration } from "@/lib/reports-metrics";
import { getReports, reportPeriodLabel, type Reports, type ReportPeriod } from "@/lib/reports";
import { buildReportFigures, generateMonthlySummary, type MonthlyAiSummary } from "@/lib/reports-ai-summary";

function formatPercent(value: number | null): string {
  return value == null ? "—" : `${value.toFixed(1).replace(".", ",")}%`;
}

export type MonthlyReportEmailContent = { subject: string; html: string };

/**
 * Arma el HTML del informe mensual: la narrativa de la IA arriba (siempre
 * junto a los números reales, nunca sola) y abajo una tabla con las mismas
 * cifras que ya ve el dueño en /reports — mismo criterio que
 * `daily-summary.ts` (HTML inline simple, sin plantilla aparte).
 */
export function buildMonthlyReportEmail(
  reports: Reports,
  period: ReportPeriod,
  ai: MonthlyAiSummary,
): MonthlyReportEmailContent {
  const monthLabel = reportPeriodLabel(period);
  const { kpis, occupancy, revenue, extras, bookings, whatsapp } = reports;

  const rows: [string, string][] = [
    ["Ingresos (Caja)", formatArs(kpis.incomeTotal)],
    ["Egresos (Caja)", formatArs(kpis.expenseTotal)],
    ["Neto (Caja)", formatArs(kpis.netTotal)],
    ["Alquileres finalizados", String(kpis.finished)],
    ["Ocupación de la flota", formatPercent(occupancy.percent)],
    ["Flota activa", `${occupancy.activeFleetUnits} de ${occupancy.fleetUnits} autos`],
    ["Ticket promedio", revenue.averageTicket == null ? "—" : formatArs(revenue.averageTicket)],
    ["Extras liquidados (km/nafta/daños)", formatArs(extras.total)],
    ["Reservas / canceladas", `${bookings.total} / ${bookings.cancelled} (${formatPercent(bookings.cancellationPercent)})`],
    ["WhatsApp — conversaciones únicas", String(whatsapp.conversationsInPeriod)],
    ["WhatsApp — conversión", formatPercent(whatsapp.conversionPercent)],
    ["WhatsApp — respuesta (mediana)", formatDuration(whatsapp.response.medianMinutes)],
  ];

  const tableRows = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#555;">${label}</td><td style="padding:4px 0;font-weight:600;">${value}</td></tr>`,
    )
    .join("");

  const html = `
    <h1 style="margin:0 0 4px;">Informe de ${monthLabel}</h1>
    <p style="margin:0 0 16px;font-size:16px;color:#333;"><strong>${ai.headline}</strong></p>
    <ul style="margin:0 0 16px;padding-left:20px;">
      ${ai.highlights.map((h) => `<li style="margin-bottom:4px;">${h}</li>`).join("")}
    </ul>
    <p style="margin:0 0 20px;white-space:pre-line;">${ai.narrative}</p>
    <table style="border-collapse:collapse;font-size:14px;">${tableRows}</table>
    <p style="margin:20px 0 0;font-size:12px;color:#888;">
      El texto de arriba lo escribió una IA a partir de los números de esta tabla (salen de Caja y las reservas,
      no los inventa) — es un resumen, no un dato nuevo. Ver el detalle completo en /reports.
    </p>
  `;

  return { subject: `Andes — Informe de ${monthLabel}`, html };
}

export type MonthlyReportResult =
  | { sent: true; subject: string; to: string }
  | { sent: false; reason: "email-no-configurado" | "ia-no-configurada" | "error-ia" };

/**
 * Calcula el informe del período, le pide la narrativa a Claude y lo manda
 * por Resend al admin. Best-effort, mismo criterio que
 * `sendDailySummaryEmail` — avisa por consola y no revienta si algo no está
 * configurado. La usa el botón manual de /reports (admin).
 */
export async function sendMonthlyReportEmail(period: ReportPeriod): Promise<MonthlyReportResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const to = process.env.ADMIN_EMAIL;
  if (!apiKey || !from || !to) {
    console.warn("[monthly-report] Resend no configurado — email omitido");
    return { sent: false, reason: "email-no-configurado" };
  }
  if (!env.hasLlm) {
    console.warn("[monthly-report] ANTHROPIC_API_KEY no configurada — informe omitido");
    return { sent: false, reason: "ia-no-configurada" };
  }

  const reports = await getReports(period);
  const monthLabel = reportPeriodLabel(period);
  const figures = buildReportFigures(reports, monthLabel);

  let ai: MonthlyAiSummary;
  try {
    ai = await generateMonthlySummary(figures, monthLabel);
  } catch (e) {
    console.error("[monthly-report] Claude no devolvió el informe", e);
    return { sent: false, reason: "error-ia" };
  }

  const { subject, html } = buildMonthlyReportEmail(reports, period, ai);

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  await resend.emails.send({ from, to: [to], subject, html });

  return { sent: true, subject, to };
}
