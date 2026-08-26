import "server-only";
import { formatDateTime } from "@/lib/datetime";
import { getDashboardData } from "@/lib/dashboard";
import { vehicleLabelWithPlate } from "@/lib/vehicle-ui";

type DashboardAlerts = Awaited<ReturnType<typeof getDashboardData>>["alerts"];
type OverdueReturn = DashboardAlerts["overdueReturns"][number];
type ServiceCandidate = DashboardAlerts["upcomingServices"][number];

export type DailySummaryContent = { subject: string; html: string };

/**
 * Arma el resumen diario de alertas **vencidas** (devoluciones + service) a
 * partir de las mismas alertas que ya calcula el dashboard de Home — así no
 * duplica el criterio de qué cuenta como vencido. A diferencia del dashboard
 * (que también muestra "próximo"), acá solo entra lo ya vencido: es un mail,
 * no hace falta avisar de algo que todavía no pasó. `null` si no hay nada
 * (no manda un mail vacío todos los días).
 */
export function buildDailySummary(
  overdueReturns: OverdueReturn[],
  upcomingServices: ServiceCandidate[],
): DailySummaryContent | null {
  const overdueServices = upcomingServices.filter((v) => v.overdue);
  const total = overdueReturns.length + overdueServices.length;
  if (total === 0) return null;

  const sections: string[] = [];
  if (overdueReturns.length > 0) {
    sections.push(
      `<h2>Devoluciones vencidas (${overdueReturns.length})</h2><ul>` +
        overdueReturns
          .map(
            (r) =>
              `<li>${r.clientName} — ${r.vehicle ? vehicleLabelWithPlate(r.vehicle) : "sin unidad"} (vencía ${formatDateTime(r.endAt)})</li>`,
          )
          .join("") +
        `</ul>`,
    );
  }
  if (overdueServices.length > 0) {
    sections.push(
      `<h2>Service vencido (${overdueServices.length})</h2><ul>` +
        overdueServices
          .map(
            (v) =>
              `<li>${vehicleLabelWithPlate(v)} (${v.currentKm - v.nextServiceKm!} km pasado)</li>`,
          )
          .join("") +
        `</ul>`,
    );
  }

  return {
    subject: `Andes — ${total} alerta${total === 1 ? "" : "s"} pendiente${total === 1 ? "" : "s"}`,
    html: `<p>Resumen diario de Andes:</p>${sections.join("")}`,
  };
}

export type DailySummaryResult =
  | { sent: true; subject: string }
  | { sent: false; reason: "sin-alertas" | "email-no-configurado" };

/**
 * Calcula y manda el resumen diario al admin por Resend. Best-effort, mismo
 * criterio que el resto de los emails transaccionales (avisa por consola y
 * no rompe el caller si Resend no está configurado). La usan tanto el cron
 * (`/api/daily-summary`, autenticado por CRON_SECRET) como el botón manual
 * de prueba en /sync (autenticado por sesión de admin).
 */
export async function sendDailySummaryEmail(): Promise<DailySummaryResult> {
  const { alerts } = await getDashboardData();
  const summary = buildDailySummary(alerts.overdueReturns, alerts.upcomingServices);
  if (!summary) return { sent: false, reason: "sin-alertas" };

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const to = process.env.ADMIN_EMAIL;
  if (!apiKey || !from || !to) {
    console.warn("[daily-summary] Resend no configurado — email omitido");
    return { sent: false, reason: "email-no-configurado" };
  }

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  await resend.emails.send({ from, to: [to], subject: summary.subject, html: summary.html });

  return { sent: true, subject: summary.subject };
}
