"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/button";
import { DateField, FormError, TextField, TextareaField } from "@/components/ui/fields";
import { FuelSelector } from "@/components/inspection/fuel-selector";
import { SignatureCanvas, type SignaturePadHandle } from "@/components/inspection/signature-canvas";
import { newId } from "@/components/inspection/wizard/new-id";
import { createOwnerContract } from "@/app/(app)/vehicles/[id]/owner-contract/actions";
import {
  missingConditionCount,
  OWNER_CONTRACT_CHECKLIST,
  OWNER_CONTRACT_STEPS,
  parseClauses,
  validateOwnerContractStep,
  type OwnerContractDraft,
} from "@/lib/owner-contract";

type WizardVehicle = {
  id: string;
  brand: string;
  model: string;
  year: number | null;
  plate: string;
  fuelLevels: number;
};

const FIRST_SIGNATURE_STEP = 3;
const LAST_STEP = OWNER_CONTRACT_STEPS.length - 1;

/**
 * Contrato de cesión, un paso por pantalla: datos del propietario, plazo, estado
 * del auto y las dos firmas. Los datos se autoguardan en el dispositivo; las
 * firmas no (quedan solo en memoria y se piden de nuevo si se vuelve atrás, para
 * que nadie firme algo distinto de lo que leyó).
 */
export function OwnerContractWizard({
  vehicle,
  initial,
  text,
}: {
  vehicle: WizardVehicle;
  initial: OwnerContractDraft;
  text: { versionId: string | null; title: string; body: string };
}) {
  const router = useRouter();
  const storageKey = `andes-owner-contract:${vehicle.id}`;
  const [draft, setDraft] = useState(initial);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [companySignature, setCompanySignature] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contractId] = useState(newId);
  const [loaded, setLoaded] = useState(false);
  const signatureRef = useRef<SignaturePadHandle>(null);
  // Lock síncrono: un doble toque con mala señal no puede disparar dos guardados.
  const savingRef = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setDraft((d) => ({ ...d, ...JSON.parse(raw) }));
    } catch {
      // Sin acceso al almacenamiento local: arranca con los datos precargados.
    }
    setLoaded(true);
  }, [storageKey]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {
      // El borrador local es una comodidad: sin él, el contrato se puede firmar igual.
    }
  }, [draft, loaded, storageKey]);

  const set = <K extends keyof OwnerContractDraft>(key: K, value: OwnerContractDraft[K]) => {
    setError(null);
    setDraft((d) => ({ ...d, [key]: value }));
  };
  const field = (key: keyof OwnerContractDraft) => (e: { target: { value: string } }) => {
    setError(null);
    setDraft((d) => ({ ...d, [key]: e.target.value }));
  };

  function goTo(next: number) {
    setError(null);
    setStep(next);
    window.scrollTo(0, 0);
  }

  function back() {
    // Volver desde una firma invalida las dos: lo firmado ya no se puede editar en silencio.
    if (step >= FIRST_SIGNATURE_STEP) {
      setCompanySignature("");
      setAccepted(false);
    }
    goTo(step - 1);
  }

  function signatureFromPad(missing: string): string | null {
    const pad = signatureRef.current;
    if (!pad || pad.isEmpty()) {
      setError(missing);
      return null;
    }
    return pad.toDataURL();
  }

  function next() {
    const invalid = validateOwnerContractStep(step, draft);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (step === FIRST_SIGNATURE_STEP) {
      const signature = signatureFromPad("Falta la firma de MDZ Rent a Car.");
      if (!signature) return;
      setCompanySignature(signature);
    }
    goTo(step + 1);
  }

  async function save() {
    if (savingRef.current) return;
    if (!accepted) {
      setError("El propietario tiene que aceptar las condiciones antes de firmar.");
      return;
    }
    const ownerSignature = signatureFromPad("Falta la firma del propietario.");
    if (!ownerSignature) return;

    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const result = await createOwnerContract({
        id: contractId,
        vehicleId: vehicle.id,
        versionId: text.versionId,
        draft,
        companySignature,
        ownerSignature,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // Nada que hacer: el borrador viejo se pisa con la próxima precarga.
      }
      router.push(`/vehicles/${vehicle.id}?tab=contrato&signed=1`);
    } catch {
      setError("No se pudo guardar. Revisá la conexión y volvé a tocar \"Firmar y guardar\": no se pierde la firma.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex gap-1">
          {OWNER_CONTRACT_STEPS.map((label, i) => (
            <span key={label} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-foreground" : "bg-foreground/15"}`} />
          ))}
        </div>
        <p className="mt-2 text-sm text-foreground/60">
          Paso {step + 1} de {OWNER_CONTRACT_STEPS.length} ·{" "}
          <span className="font-medium text-foreground">{OWNER_CONTRACT_STEPS[step]}</span>
        </p>
      </div>

      {step === 0 && (
        <div className="flex flex-col gap-4">
          <TextField id="ownerName" label="Nombre y apellido" value={draft.ownerName} onChange={field("ownerName")} autoComplete="off" />
          <TextField id="ownerDocNumber" label="DNI / Pasaporte / CUIT" value={draft.ownerDocNumber} onChange={field("ownerDocNumber")} autoComplete="off" />
          <TextField id="ownerAddress" label="Domicilio real" value={draft.ownerAddress} onChange={field("ownerAddress")} autoComplete="off" />
          <TextField id="ownerEmail" type="email" inputMode="email" label="Email" hint="Opcional. Recibe la copia en PDF." value={draft.ownerEmail} onChange={field("ownerEmail")} autoComplete="off" />
          <TextField id="ownerPhone" type="tel" label="Teléfono" hint="Opcional." value={draft.ownerPhone} onChange={field("ownerPhone")} autoComplete="off" />
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <TextField id="place" label="Lugar" value={draft.place} onChange={field("place")} />
          <div className="grid grid-cols-2 gap-3">
            <DateField id="startDate" label="Desde el día" value={draft.startDate} onChange={(v) => set("startDate", v)} />
            <TextField id="startTime" type="time" label="Hora" value={draft.startTime} onChange={field("startTime")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <DateField id="endDate" label="Hasta el día" value={draft.endDate} onChange={(v) => set("endDate", v)} />
            <TextField id="endTime" type="time" label="Hora" value={draft.endTime} onChange={field("endTime")} />
          </div>
          <TextareaField
            id="commercialTerms"
            label="Condiciones comerciales y particulares"
            hint="Opcional. Ej.: qué le corresponde al propietario, quién paga service y multas. Se imprime en el contrato."
            rows={4}
            value={draft.commercialTerms}
            onChange={field("commercialTerms")}
          />
        </div>
      )}

      {step === 2 && <ConditionStep draft={draft} set={set} field={field} maxFuel={vehicle.fuelLevels} />}

      {step === 3 && (
        <div className="flex flex-col gap-4">
          <ContractPreview draft={draft} vehicle={vehicle} text={text} collapsed />
          <TextField id="companySignerName" label="Firma por MDZ Rent a Car" value={draft.companySignerName} onChange={field("companySignerName")} />
          <SignatureCanvas key="company" ref={signatureRef} />
          <button type="button" className="self-start text-sm text-foreground/60 underline" onClick={() => signatureRef.current?.clear()}>
            Borrar firma
          </button>
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-4">
          <ContractPreview draft={draft} vehicle={vehicle} text={text} />
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-foreground/15 px-4 py-3 text-sm">
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 size-5 shrink-0" />
            <span className="text-foreground/80">Leí y acepto las condiciones de este contrato.</span>
          </label>
          <div className={`flex flex-col gap-3 ${accepted ? "" : "pointer-events-none opacity-50"}`} aria-disabled={!accepted}>
            <p className="text-sm font-medium">Firma de {draft.ownerName.trim()}</p>
            <SignatureCanvas key="owner" ref={signatureRef} />
            <button type="button" className="self-start text-sm text-foreground/60 underline" onClick={() => signatureRef.current?.clear()}>
              Borrar firma
            </button>
          </div>
        </div>
      )}

      {error && <FormError>{error}</FormError>}

      <div className="flex items-center justify-between gap-3">
        {step === 0 ? (
          <ButtonLink href={`/vehicles/${vehicle.id}`} variant="secondary">Cancelar</ButtonLink>
        ) : (
          <Button type="button" variant="secondary" onClick={back} disabled={saving}>Atrás</Button>
        )}
        {step < LAST_STEP ? (
          <Button type="button" onClick={next}>Siguiente</Button>
        ) : (
          <Button type="button" onClick={save} disabled={saving || !accepted}>
            {saving ? "Guardando…" : "Firmar y guardar"}
          </Button>
        )}
      </div>
    </div>
  );
}

function ConditionStep({
  draft,
  set,
  field,
  maxFuel,
}: {
  draft: OwnerContractDraft;
  set: <K extends keyof OwnerContractDraft>(key: K, value: OwnerContractDraft[K]) => void;
  field: (key: keyof OwnerContractDraft) => (e: { target: { value: string } }) => void;
  maxFuel: number;
}) {
  const missing = missingConditionCount(draft.responses);
  const answer = (key: string, value: string | boolean) => set("responses", { ...draft.responses, [key]: value });
  const optionClass = (selected: boolean) =>
    `min-h-11 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors ${
      selected ? "border-foreground bg-foreground text-background" : "border-foreground/15 text-foreground/80"
    }`;

  return (
    <div className="flex flex-col gap-5">
      <TextField id="km" type="number" inputMode="numeric" min={0} label="Kilometraje" suffix="km" value={draft.km} onChange={field("km")} />
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground/80">Nivel de combustible</span>
        <FuelSelector value={draft.fuelLevel} onChange={(v) => set("fuelLevel", v)} max={maxFuel} />
      </div>

      {OWNER_CONTRACT_CHECKLIST.map((group) => (
        <section key={group.title} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">{group.title}</h2>
          {group.items.map((item) =>
            item.kind === "choice" ? (
              <div key={item.key} className="flex flex-wrap gap-2">
                {item.options.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    aria-pressed={draft.responses[item.key] === o.value}
                    className={optionClass(draft.responses[item.key] === o.value)}
                    onClick={() => answer(item.key, o.value)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            ) : (
              <button
                key={item.key}
                type="button"
                aria-pressed={draft.responses[item.key] === true}
                className={optionClass(draft.responses[item.key] === true)}
                onClick={() => answer(item.key, draft.responses[item.key] !== true)}
              >
                {draft.responses[item.key] === true ? "✓ " : ""}
                {item.label}
              </button>
            ),
          )}
        </section>
      ))}

      <TextareaField id="observations" label="Observaciones" hint="Opcional." rows={3} value={draft.observations} onChange={field("observations")} />
      <p className={`text-sm font-medium ${missing > 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}`}>
        {missing > 0 ? `Faltan ${missing} ${missing === 1 ? "punto" : "puntos"} por elegir` : "Completo ✓"}
      </p>
    </div>
  );
}

function ContractPreview({
  draft,
  vehicle,
  text,
  collapsed = false,
}: {
  draft: OwnerContractDraft;
  vehicle: WizardVehicle;
  text: { title: string; body: string };
  collapsed?: boolean;
}) {
  const content = (
    <div className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1 text-sm leading-relaxed text-foreground/80">
      <p>
        Propietario: <strong>{draft.ownerName.trim()}</strong>, documento {draft.ownerDocNumber.trim()}, domicilio {draft.ownerAddress.trim()}.
      </p>
      <p>
        Vehículo: <strong>{vehicle.brand} {vehicle.model}</strong>{vehicle.year ? ` (${vehicle.year})` : ""}, dominio {vehicle.plate}. Ingresa con{" "}
        {Number(draft.km).toLocaleString("es-AR")} km y combustible {draft.fuelLevel}/{vehicle.fuelLevels}.
      </p>
      <p>
        Plazo: del {draft.startDate.split("-").reverse().join("/")} {draft.startTime} al {draft.endDate.split("-").reverse().join("/")} {draft.endTime}.
      </p>
      {draft.commercialTerms.trim() && (
        <>
          <p className="mt-2 font-semibold uppercase">Condiciones comerciales y particulares</p>
          <p className="whitespace-pre-line">{draft.commercialTerms.trim()}</p>
        </>
      )}
      {parseClauses(text.body).map((block, i) => {
        if (block.kind === "heading") return <p key={i} className="mt-2 font-semibold">{block.text}</p>;
        if (block.kind === "paragraph") return <p key={i} className="whitespace-pre-line">{block.text}</p>;
        return (
          <ul key={i} className="list-disc pl-5">
            {block.items.map((item, j) => <li key={j}>{item}</li>)}
          </ul>
        );
      })}
    </div>
  );

  if (collapsed) {
    return (
      <details className="rounded-xl border border-foreground/10 px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium">Ver el contrato</summary>
        <div className="mt-3">{content}</div>
      </details>
    );
  }
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-foreground/10 px-4 py-3">
      <p className="text-sm font-semibold">{text.title}</p>
      {content}
    </section>
  );
}
