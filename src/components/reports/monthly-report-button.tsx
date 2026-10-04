"use client";

import { useState, useTransition } from "react";
import type { MonthlyReportResult } from "@/lib/monthly-report-email";
import type { ReportPeriod } from "@/lib/reports";

const REASON_LABEL: Record<Exclude<MonthlyReportResult, { sent: true }>["reason"], string> = {
  "email-no-configurado": "Falta configurar el email (Resend) en el servidor.",
  "ia-no-configurada": "Falta configurar ANTHROPIC_API_KEY en el servidor.",
  "error-ia": "La IA no pudo generar el informe — probá de nuevo.",
};

/** Botón "Generar informe (IA) y enviarlo por email" — solo para un mes ya cerrado (ver page.tsx). */
export function MonthlyReportButton({
  period,
  sendMonthlyReport,
}: {
  period: ReportPeriod;
  sendMonthlyReport: (period: ReportPeriod) => Promise<MonthlyReportResult>;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<MonthlyReportResult | null>(null);

  const run = () =>
    start(async () => {
      setResult(null);
      try {
        setResult(await sendMonthlyReport(period));
      } catch {
        setResult({ sent: false, reason: "error-ia" });
      }
    });

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-foreground/10 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Informe mensual con IA</p>
          <p className="text-xs text-foreground/50">
            Genera una narrativa con Claude sobre los números de este mes y la manda por email al admin.
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="h-9 shrink-0 rounded-lg border border-foreground/15 px-3 text-sm font-medium disabled:opacity-60"
        >
          {pending ? "Generando…" : "Generar y enviar"}
        </button>
      </div>
      {result &&
        (result.sent ? (
          <p className="text-sm font-medium text-emerald-600">Enviado a {result.to} ✓</p>
        ) : (
          <p className="text-sm font-medium text-red-600">{REASON_LABEL[result.reason]}</p>
        ))}
    </div>
  );
}
