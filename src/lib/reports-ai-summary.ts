import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import { formatArs } from "@/lib/contract";
import { formatDuration } from "@/lib/reports-metrics";
import type { Reports } from "@/lib/reports";

// Sonnet, no Haiku: esto es prosa para el dueño (narrativa de un informe
// mensual), no clasificación acotada como en competitor-prices/llm.ts — se
// usa una vez al mes, así que la calidad del texto pesa más que el costo.
const MODEL = "claude-sonnet-5";

function client(): Anthropic {
  return new Anthropic({ apiKey: env.llm.apiKey });
}

function formatPercent(value: number | null): string {
  return value == null ? "sin datos" : `${value.toFixed(1).replace(".", ",")}%`;
}

function formatDays(value: number | null): string {
  return value == null ? "sin datos" : `${value.toFixed(1).replace(".", ",")} días`;
}

/**
 * Vuelca a texto plano los números clave que ya calculó `getReports` — es la
 * ÚNICA fuente de verdad numérica que ve el modelo (ver `generateMonthlySummary`:
 * la instrucción es citar estos números tal cual, nunca inventar ni redondear
 * distinto). Separado de `generateMonthlySummary` para poder testearlo sin
 * llamar a Claude.
 */
export function buildReportFigures(reports: Reports, monthLabel: string): string {
  const { kpis, occupancy, revenue, extras, bookings, whatsapp, vehicles } = reports;

  const byNet = [...vehicles].sort((a, b) => b.net - a.net);
  const top = byNet.slice(0, 3);
  const bottom = byNet.length > 3 ? byNet.slice(-3).reverse() : [];

  const lines = [
    `Mes: ${monthLabel}`,
    "",
    "CAJA (movimientos reales del período):",
    `- Ingresos: ${formatArs(kpis.incomeTotal)}`,
    `- Egresos: ${formatArs(kpis.expenseTotal)}`,
    `- Neto: ${formatArs(kpis.netTotal)}`,
    `- Costos de mantenimiento registrados: ${formatArs(kpis.costTotal)}`,
    "",
    "OCUPACIÓN Y RENTABILIDAD (alquileres finalizados del período):",
    `- Ocupación de la flota: ${formatPercent(occupancy.percent)} (${occupancy.rentedDays.toFixed(0)} de ${occupancy.availableDays.toFixed(0)} días, sobre ${occupancy.fleetUnits} autos)`,
    `- Flota activa (autos distintos que alquilaron algo): ${occupancy.activeFleetUnits} de ${occupancy.fleetUnits}`,
    `- Alquileres finalizados: ${kpis.finished}`,
    `- Ingreso por día alquilado: ${revenue.perRentedDay == null ? "sin datos" : formatArs(revenue.perRentedDay)}`,
    `- Ticket promedio: ${revenue.averageTicket == null ? "sin datos" : formatArs(revenue.averageTicket)}`,
    `- Duración promedio: ${formatDays(revenue.averageDays)}`,
    "",
    "EXTRAS DE LA DEVOLUCIÓN (liquidados, no necesariamente cobrados):",
    `- Total: ${formatArs(extras.total)} (${formatPercent(extras.percentOfIncome)} de los ingresos del contrato)`,
    `- Km extra: ${formatArs(extras.km)}`,
    `- Nafta: ${formatArs(extras.fuel)}`,
    `- Daños: ${formatArs(extras.damages)}`,
    "",
    "RESERVAS (retiro en el período, sin bloqueos de service):",
    `- Total: ${bookings.total}`,
    `- Canceladas: ${bookings.cancelled} (${formatPercent(bookings.cancellationPercent)})`,
    `- Anticipación promedio con la que se reserva: ${formatDays(bookings.leadTime.averageDays)} (mediana ${bookings.leadTime.medianDays == null ? "sin datos" : `${bookings.leadTime.medianDays.toFixed(0)} días`})`,
    "",
    "WHATSAPP:",
    `- Conversaciones únicas: ${whatsapp.conversationsInPeriod}`,
    `- Conversión (alquileres finalizados / conversaciones): ${formatPercent(whatsapp.conversionPercent)}`,
    `- Tiempo de respuesta (mediana): ${formatDuration(whatsapp.response.medianMinutes)} (respuesta humana: ${formatDuration(whatsapp.response.humanMedianMinutes)})`,
    `- Consultas sin respuesta: ${whatsapp.response.unanswered}`,
    "",
    "TOP 3 VEHÍCULOS POR NETO (mayor a menor):",
    ...top.map(
      (v, i) => `${i + 1}. ${v.label} (${v.plate}) — neto ${formatArs(v.net)}, ${v.rentals} alquileres, ${v.occupancyPercent.toFixed(0)}% de ocupación`,
    ),
  ];

  if (bottom.length > 0) {
    lines.push(
      "",
      "VEHÍCULOS CON PEOR NETO DEL PERÍODO:",
      ...bottom.map(
        (v, i) => `${i + 1}. ${v.label} (${v.plate}) — neto ${formatArs(v.net)}, ${v.rentals} alquileres, ${v.occupancyPercent.toFixed(0)}% de ocupación`,
      ),
    );
  }

  return lines.join("\n");
}

export type MonthlyAiSummary = { headline: string; highlights: string[]; narrative: string };

/**
 * Le pide a Claude que escriba la narrativa del informe mensual a partir de
 * `figures` (texto armado por `buildReportFigures`, los únicos números que
 * puede usar). `tool_choice` forzado para que la respuesta venga siempre
 * estructurada — mismo patrón que `competitor-prices/llm.ts`.
 */
export async function generateMonthlySummary(figures: string, monthLabel: string): Promise<MonthlyAiSummary> {
  const msg = await client().messages.create({
    model: MODEL,
    max_tokens: 1200,
    system:
      "Sos un analista que redacta el informe mensual de MDZ Rent a Car (Mendoza, Argentina) para el dueño del " +
      "negocio. Escribís en español rioplatense, directo y concreto, como para alguien que dirige el día a día del " +
      "negocio y quiere enterarse de lo importante en 30 segundos. REGLA ABSOLUTA: nunca inventes, redondees distinto " +
      "ni calcules un número que no esté tal cual en los datos que te paso — citá los números exactamente como vienen. " +
      "Si un dato dice \"sin datos\", no inventes un valor para reemplazarlo. Destacá tanto lo bueno como lo malo: " +
      "caídas de ocupación o ingresos, autos que rindieron mal, cancelación alta, demoras respondiendo WhatsApp, daños " +
      "o extras altos, etc. No repitas mecánicamente todos los números — eso ya va en una tabla aparte del email; tu " +
      "trabajo es decir qué significa y qué merece atención.",
    tools: [
      {
        name: "write_report",
        description: "Entrega la narrativa del informe mensual, ya estructurada para el email.",
        input_schema: {
          type: "object",
          properties: {
            headline: { type: "string", description: "Una frase (máx. ~15 palabras) que resuma el mes." },
            highlights: {
              type: "array",
              items: { type: "string" },
              minItems: 3,
              maxItems: 5,
              description: "3 a 5 puntos cortos, lo más relevante del mes (bueno y malo).",
            },
            narrative: {
              type: "string",
              description: "1 a 2 párrafos de contexto y análisis, en español rioplatense.",
            },
          },
          required: ["headline", "highlights", "narrative"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "write_report" },
    messages: [{ role: "user", content: `Datos del informe de ${monthLabel}:\n\n${figures}` }],
  });

  const use = msg.content.find((b) => b.type === "tool_use");
  if (!use || use.type !== "tool_use") throw new Error("Claude no devolvió el informe estructurado");
  return use.input as MonthlyAiSummary;
}
