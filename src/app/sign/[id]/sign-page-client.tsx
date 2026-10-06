"use client";

import { useState } from "react";
import { getDictionary, type Locale } from "@/lib/i18n";
import { COMPANY } from "@/lib/contract";
import { AutoRefresh } from "@/components/auto-refresh";
import type { ClientFieldKey, SignatureSummary } from "@/lib/remote-signature";
import { RemoteSignForm, SignatureSummaryView } from "./sign-form";
import { ClientContactForm } from "./contact-form";

export type SignOutcome = "invalid" | "active" | "signed" | "expired" | "cancelled";

/**
 * Pantalla pública /sign/[id]. El pedido original (Fase 10) tenía como
 * objetivo principal firmar; acá se invierte la prioridad: lo primero y más
 * grande en pantalla son las condiciones generales del contrato (lo que el
 * cliente tiene que poder leer), y completar sus datos o firmar queda
 * después, en bloques más chicos — es "lo que cargamos nosotros", secundario.
 * Toggle de idioma propio de esta pantalla (ES/EN), independiente del idioma
 * elegido para el acta — el cliente puede leer en el idioma que prefiera
 * aunque el contrato final quede en el otro.
 */
export function SignPageClient({
  id,
  initialLocale,
  outcome,
  waitingForCompletion,
  isReturn,
  summary,
  missingFields,
  defaultName,
}: {
  id?: string;
  initialLocale: Locale;
  outcome: SignOutcome;
  waitingForCompletion?: boolean;
  isReturn?: boolean;
  summary?: SignatureSummary;
  missingFields?: ClientFieldKey[];
  defaultName?: string;
}) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const dict = getDictionary(locale);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-5 py-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-green-700 dark:text-green-500">{COMPANY.name}</p>
          <p className="text-sm text-foreground/60">{dict.remoteSign.intro}</p>
        </div>
        <LocaleToggle locale={locale} onChange={setLocale} />
      </div>

      {outcome === "invalid" ? (
        <Message text={dict.remoteSign.linkInvalid} />
      ) : outcome === "signed" ? (
        <Message text={dict.remoteSign.alreadySigned} tone="ok" />
      ) : outcome === "expired" ? (
        <Message text={dict.remoteSign.linkExpired} />
      ) : outcome === "cancelled" ? (
        <Message text={dict.remoteSign.cancelled} />
      ) : (
        <>
          <AutoRefresh intervalMs={waitingForCompletion ? 3000 : 4000} />

          {/* Lo más importante de la pantalla: las condiciones generales del
              contrato, completas y legibles — no un recuadro chico con scroll. */}
          <section className="flex flex-col gap-3 rounded-xl border border-foreground/15 bg-foreground/[0.03] p-4">
            <h2 className="text-base font-semibold text-foreground">{dict.legal.title}</h2>
            <div className="flex flex-col gap-3 text-sm leading-relaxed text-foreground/80">
              {dict.legal.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              <p>{dict.legal.photoConsent}</p>
              <p>{dict.legal.jurisdiction}</p>
              <p className="font-medium text-foreground">{dict.legal.acceptance}</p>
            </div>
          </section>

          {/* Secundario: lo que cargó el empleado (vehículo, km, nafta, daños,
              condiciones económicas / liquidación) — colapsado por defecto. */}
          {summary && (
            <details className="rounded-xl border border-foreground/10 px-4 py-3">
              <summary className="cursor-pointer text-sm font-semibold text-foreground/60">
                {dict.remoteSign.summaryHeading}
              </summary>
              <div className="mt-3 flex flex-col gap-3">
                <SignatureSummaryView summary={summary} isReturn={Boolean(isReturn)} dict={dict} />
              </div>
            </details>
          )}

          {id && missingFields && missingFields.length > 0 && (
            <ClientContactForm id={id} missing={missingFields} dict={dict} />
          )}

          {waitingForCompletion ? (
            <p className="rounded-xl border border-foreground/15 px-4 py-6 text-center text-xs text-foreground/50">
              {isReturn ? dict.remoteSign.waitingReturn : dict.remoteSign.waitingHandover}
            </p>
          ) : (
            id && <RemoteSignForm id={id} dict={dict} defaultName={defaultName ?? ""} />
          )}
        </>
      )}
    </div>
  );
}

function LocaleToggle({ locale, onChange }: { locale: Locale; onChange: (l: Locale) => void }) {
  return (
    <div className="flex shrink-0 overflow-hidden rounded-lg border border-foreground/15 text-xs font-medium">
      {(["es", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(l)}
          className={`px-2.5 py-1.5 transition-colors ${
            locale === l ? "bg-green-700 text-white" : "text-foreground/60"
          }`}
        >
          {l === "es" ? "Español" : "English"}
        </button>
      ))}
    </div>
  );
}

function Message({ text, tone }: { text: string; tone?: "ok" }) {
  return (
    <p
      className={`rounded-xl border px-4 py-6 text-center text-sm font-medium ${
        tone === "ok"
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "border-foreground/15 text-foreground/70"
      }`}
    >
      {text}
    </p>
  );
}
