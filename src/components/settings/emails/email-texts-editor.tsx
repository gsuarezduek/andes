"use client";

import { useState } from "react";
import { TabBar } from "@/components/ui/tabs";
import { TextField, TextareaField } from "@/components/ui/fields";
import type { Dictionary, Locale } from "@/lib/i18n";

type EmailTexts = Dictionary["email"];
type Key = keyof EmailTexts;
type Kind = "handover" | "return";

const LOCALES: { locale: Locale; label: string }[] = [
  { locale: "es", label: "Español" },
  { locale: "en", label: "Inglés" },
];

/** Nombre del campo del form/modelo: `es` + `HandoverSubject`. */
const fieldId = (locale: Locale, key: Key) => `${locale}${key[0].toUpperCase()}${key.slice(1)}`;

/**
 * Textos del correo del acta, por idioma (pestañas) y por tipo (entrega /
 * devolución), con una vista previa en vivo de cómo le llega al cliente.
 * Las dos pestañas de idioma quedan montadas (solo se ocultan): si se
 * desmontaran, sus campos no viajarían con el form y se borrarían al guardar.
 */
export function EmailTextsEditor({
  values,
  defaults,
}: {
  values: Record<Locale, Partial<Record<Key, string>>>;
  defaults: Record<Locale, EmailTexts>;
}) {
  const [tab, setTab] = useState(0);
  return (
    <div className="flex flex-col gap-4">
      <TabBar sections={LOCALES.map((l) => l.label)} active={tab} onChange={setTab} />
      {LOCALES.map(({ locale }, i) => (
        <div key={locale} hidden={i !== tab}>
          {locale === "en" && (
            <p className="mb-4 text-xs text-foreground/50">
              Se usan solo en alquileres marcados en inglés (el idioma se elige en cada reserva).
            </p>
          )}
          <p className="mb-4 text-xs text-foreground/50">
            Un campo vacío usa el texto por defecto, que se ve en gris adentro del campo.
          </p>
          <LocaleEditor locale={locale} initial={values[locale]} defaults={defaults[locale]} />
        </div>
      ))}
    </div>
  );
}

function LocaleEditor({
  locale,
  initial,
  defaults,
}: {
  locale: Locale;
  initial: Partial<Record<Key, string>>;
  defaults: EmailTexts;
}) {
  const [v, setV] = useState<Partial<Record<Key, string>>>(initial);
  const [kind, setKind] = useState<Kind>("handover");
  const effective = (k: Key) => (v[k] ?? "").trim() || defaults[k];

  const field = (k: Key, label: string, opts: { multiline?: boolean; hint?: string } = {}) => {
    const common = {
      id: fieldId(locale, k),
      label,
      hint: opts.hint,
      value: v[k] ?? "",
      placeholder: defaults[k],
    };
    return opts.multiline ? (
      <TextareaField {...common} onChange={(e) => setV((p) => ({ ...p, [k]: e.target.value }))} />
    ) : (
      <TextField {...common} onChange={(e) => setV((p) => ({ ...p, [k]: e.target.value }))} />
    );
  };

  const subjectKey: Key = kind === "handover" ? "handoverSubject" : "returnSubject";
  const bodyKey: Key = kind === "handover" ? "handoverBody" : "returnBody";
  const sample = locale === "en" ? "John Smith" : "Juan Pérez";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 rounded-xl border border-foreground/10 p-4">
        <p className="text-sm font-semibold">Acta de entrega</p>
        {field("handoverSubject", "Asunto")}
        {field("handoverBody", "Mensaje", { multiline: true })}
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-foreground/10 p-4">
        <p className="text-sm font-semibold">Acta de devolución</p>
        {field("returnSubject", "Asunto")}
        {field("returnBody", "Mensaje", { multiline: true })}
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-foreground/10 p-4">
        <div>
          <p className="text-sm font-semibold">Partes comunes</p>
          <p className="text-xs text-foreground/50">Se usan en los dos correos.</p>
        </div>
        {field("greeting", "Saludo", { hint: "Va antes del nombre del cliente." })}
        {field("attachmentNote", "Aviso del adjunto")}
        {field("regards", "Despedida y firma", { multiline: true })}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">Vista previa</p>
          <div className="flex gap-1">
            {(["handover", "return"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                aria-pressed={kind === k}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  kind === k ? "bg-foreground text-background" : "border border-foreground/15 text-foreground/60"
                }`}
              >
                {k === "handover" ? "Entrega" : "Devolución"}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-foreground/15">
          <div className="border-b border-foreground/10 bg-foreground/[0.04] px-4 py-2 text-xs text-foreground/60">
            <span className="font-medium text-foreground/80">Asunto:</span> {effective(subjectKey)}
          </div>
          <div className="flex flex-col gap-3 whitespace-pre-line px-4 py-3 text-sm">
            <p>
              {effective("greeting")} {sample},
            </p>
            <p>{effective(bodyKey)}</p>
            <p>{effective("attachmentNote")}</p>
            <p>{effective("regards")}</p>
            <p className="inline-flex w-fit items-center gap-2 rounded-lg border border-foreground/15 px-3 py-1.5 text-xs text-foreground/60">
              📎 acta-{kind === "handover" ? "entrega" : "devolucion"}.pdf
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
