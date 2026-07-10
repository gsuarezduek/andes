"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FuelSelector } from "@/components/inspection/fuel-selector";
import { Croquis, type Marker } from "@/components/inspection/croquis";
import {
  SignatureCanvas,
  type SignaturePadHandle,
} from "@/components/inspection/signature-canvas";
import { TextField, TextareaField, SelectField, FormError } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import { compressImage, uploadMedia, mediaUrl } from "@/lib/client/media";
import { getDictionary } from "@/lib/i18n";
import { languageLabels } from "@/lib/labels";
import { saveHandover, type SaveHandoverInput } from "./actions";

type Lang = "es" | "en";
type PhotoItem = { id: string; key?: string; status: "uploading" | "done" | "error"; preview: string };
type DamageItem = {
  id: string;
  posX: number;
  posY: number;
  description: string;
  photo?: PhotoItem;
};

type Draft = {
  draftId: string;
  vehicleId: string;
  language: Lang;
  km: string;
  fuelLevel: number;
  checklist: Record<string, "ok" | "fail">;
  damages: DamageItem[];
  photos: PhotoItem[];
  observations: string;
  signerName: string;
  signatureKey?: string;
};

export type WizardProps = {
  rentalId: string;
  client: { name: string; email: string | null; phone: string | null };
  datesLabel: string;
  vehicle: { id: string; label: string; currentKm: number } | null;
  vehicleOptions: { id: string; label: string }[];
  checklistItems: { id: string; label: string }[];
  existingDamages: { posX: number; posY: number }[];
  language: Lang;
};

const STEPS = ["Datos", "Estado", "Daños", "Fotos", "Firma", "Resumen"];

function newId() {
  return crypto.randomUUID();
}

export function HandoverWizard(props: WizardProps) {
  const router = useRouter();
  const storageKey = `andes:handover:${props.rentalId}`;
  const sigRef = useRef<SignaturePadHandle>(null);
  const geo = useRef<{ lat?: number; lng?: number }>({});

  const [step, setStep] = useState(0);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const [draft, setDraft] = useState<Draft>(() => ({
    draftId: newId(),
    vehicleId: props.vehicle?.id ?? "",
    language: props.language,
    km: props.vehicle ? String(props.vehicle.currentKm) : "",
    fuelLevel: 8,
    checklist: Object.fromEntries(props.checklistItems.map((i) => [i.id, "ok"])),
    damages: [],
    photos: [],
    observations: "",
    signerName: props.client.name,
  }));

  // Hidratar desde localStorage (autoguardado).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      // Hidratación del borrador desde localStorage: solo puede ocurrir en el
      // cliente (no en SSR), por eso va en un effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setDraft((d) => ({ ...d, ...JSON.parse(raw) }));
    } catch {
      /* ignorar */
    }
    // Geolocalización opcional, no bloqueante.
    navigator.geolocation?.getCurrentPosition(
      (p) => (geo.current = { lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, timeout: 5000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persistir en cada cambio (sin las previews de sesión: se reconstruyen desde la clave).
  useEffect(() => {
    const serializable = {
      ...draft,
      photos: draft.photos.filter((p) => p.key).map((p) => ({ ...p, preview: "" })),
      damages: draft.damages.map((d) => ({
        ...d,
        photo: d.photo?.key ? { ...d.photo, preview: "" } : undefined,
      })),
    };
    try {
      localStorage.setItem(storageKey, JSON.stringify(serializable));
    } catch {
      /* cuota llena, etc. */
    }
  }, [draft, storageKey]);

  const dict = getDictionary(draft.language);
  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  // --- Subida de fotos ------------------------------------------------------
  async function addPhotos(files: FileList | null, target: "main" | { damageId: string }) {
    if (!files) return;
    for (const file of Array.from(files)) {
      const id = newId();
      const preview = URL.createObjectURL(file);
      const item: PhotoItem = { id, status: "uploading", preview };
      if (target === "main") {
        setDraft((d) => ({ ...d, photos: [...d.photos, item] }));
      } else {
        setDraft((d) => ({
          ...d,
          damages: d.damages.map((dm) =>
            dm.id === target.damageId ? { ...dm, photo: item } : dm,
          ),
        }));
      }
      try {
        const blob = await compressImage(file);
        const key = await uploadMedia({
          draftId: draft.draftId,
          kind: target === "main" ? "photo" : "damage",
          blob,
          id,
        });
        updatePhoto(target, id, { key, status: "done", preview: mediaUrl(key) });
      } catch {
        updatePhoto(target, id, { status: "error" });
      }
    }
  }

  function updatePhoto(
    target: "main" | { damageId: string },
    id: string,
    patch: Partial<PhotoItem>,
  ) {
    setDraft((d) => {
      if (target === "main") {
        return { ...d, photos: d.photos.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
      }
      return {
        ...d,
        damages: d.damages.map((dm) =>
          dm.id === target.damageId && dm.photo?.id === id
            ? { ...dm, photo: { ...dm.photo, ...patch } }
            : dm,
        ),
      };
    });
  }

  const uploading = draft.photos.some((p) => p.status === "uploading") ||
    draft.damages.some((d) => d.photo?.status === "uploading");

  // --- Navegación -----------------------------------------------------------
  function validateStep(): string | undefined {
    if (step === 0 && !draft.vehicleId) return "Asigná un vehículo para continuar.";
    if (step === 1) {
      if (draft.km === "" || Number(draft.km) < 0) return "Ingresá el kilometraje.";
    }
    return undefined;
  }

  function next() {
    const v = validateStep();
    if (v) return setError(v);
    setError(undefined);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }
  function back() {
    setError(undefined);
    setStep((s) => Math.max(0, s - 1));
  }

  // --- Firma ----------------------------------------------------------------
  async function captureSignature(): Promise<string | undefined> {
    if (draft.signatureKey) return draft.signatureKey;
    const pad = sigRef.current;
    if (!pad || pad.isEmpty()) return undefined;
    const dataUrl = pad.toDataURL();
    const blob = await (await fetch(dataUrl)).blob();
    const key = await uploadMedia({ draftId: draft.draftId, kind: "signature", blob });
    patch({ signatureKey: key });
    return key;
  }

  // --- Guardar --------------------------------------------------------------
  async function submit() {
    setError(undefined);
    if (!draft.signerName.trim()) return setError("Ingresá la aclaración de la firma.");
    setSaving(true);
    try {
      const signatureKey = await captureSignature();
      if (!signatureKey) {
        setSaving(false);
        return setError("Falta la firma del cliente.");
      }
      const payload: SaveHandoverInput = {
        rentalId: props.rentalId,
        vehicleId: draft.vehicleId,
        language: draft.language,
        km: Number(draft.km),
        fuelLevel: draft.fuelLevel,
        checklist: draft.checklist,
        observations: draft.observations.trim() || undefined,
        newDamages: draft.damages.map((d) => ({
          view: "top",
          posX: d.posX,
          posY: d.posY,
          description: d.description.trim() || undefined,
          photoKey: d.photo?.key,
        })),
        photoKeys: draft.photos.filter((p) => p.key).map((p) => p.key!),
        signatureKey,
        signerName: draft.signerName.trim(),
        latitude: geo.current.lat,
        longitude: geo.current.lng,
      };
      const res = await saveHandover(payload);
      if (!res.ok) {
        setSaving(false);
        return setError(res.error);
      }
      localStorage.removeItem(storageKey);
      router.replace(`/rentals/${props.rentalId}?entrega=ok`);
    } catch {
      setSaving(false);
      setError("No se pudo guardar. Reintentá.");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* progreso */}
      <div className="flex items-center gap-1.5">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-foreground" : "bg-foreground/15"}`}
          />
        ))}
      </div>
      <p className="text-sm text-foreground/60">
        Paso {step + 1} de {STEPS.length} · <span className="font-medium text-foreground">{STEPS[step]}</span>
      </p>

      {/* PASO 0 — Datos */}
      {step === 0 && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-foreground/10 p-4 text-sm">
            <p className="font-semibold">{props.client.name}</p>
            <p className="text-foreground/60">{props.client.email ?? "sin email"}</p>
            <p className="text-foreground/60">{props.client.phone ?? "sin teléfono"}</p>
            <p className="mt-2 text-foreground/60">{props.datesLabel}</p>
          </div>
          {props.vehicle ? (
            <div className="rounded-xl border border-foreground/10 p-4 text-sm">
              <span className="text-foreground/60">Vehículo: </span>
              <span className="font-medium">{props.vehicle.label}</span>
            </div>
          ) : (
            <SelectField
              id="vehicleId"
              label="Vehículo"
              hint="Esta reserva llegó sin unidad asignada"
              value={draft.vehicleId}
              onChange={(e) => patch({ vehicleId: e.target.value })}
            >
              <option value="">Elegir vehículo…</option>
              {props.vehicleOptions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </SelectField>
          )}
          <SelectField
            id="language"
            label="Idioma del cliente"
            hint="Para el acta y los emails"
            value={draft.language}
            onChange={(e) => patch({ language: e.target.value as Lang })}
          >
            {Object.entries(languageLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </SelectField>
        </div>
      )}

      {/* PASO 1 — Estado */}
      {step === 1 && (
        <div className="flex flex-col gap-5">
          <TextField
            id="km"
            label="Kilometraje actual"
            type="number"
            inputMode="numeric"
            value={draft.km}
            onChange={(e) => patch({ km: e.target.value })}
            min={0}
          />
          <div>
            <p className="mb-2 text-sm font-medium text-foreground/80">Nivel de nafta</p>
            <FuelSelector value={draft.fuelLevel} onChange={(v) => patch({ fuelLevel: v })} />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-foreground/80">Checklist</p>
            <ul className="flex flex-col gap-2">
              {props.checklistItems.map((it) => {
                const val = draft.checklist[it.id] ?? "ok";
                return (
                  <li key={it.id} className="flex items-center justify-between gap-3">
                    <span className="text-sm">{it.label}</span>
                    <div className="flex overflow-hidden rounded-lg border border-foreground/15 text-xs">
                      {(["ok", "fail"] as const).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() =>
                            patch({ checklist: { ...draft.checklist, [it.id]: opt } })
                          }
                          className={`px-3 py-1.5 font-medium ${
                            val === opt
                              ? opt === "ok"
                                ? "bg-green-600 text-white"
                                : "bg-red-600 text-white"
                              : "text-foreground/60"
                          }`}
                        >
                          {opt === "ok" ? "OK" : "Falla"}
                        </button>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {/* PASO 2 — Daños */}
      {step === 2 && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-foreground/60">
            Tocá el croquis para marcar un daño nuevo. Los{" "}
            <span className="text-amber-600">ámbar</span> ya estaban registrados.
          </p>
          <div className="mx-auto w-full max-w-[240px]">
            <Croquis
              existing={props.existingDamages}
              markers={draft.damages as Marker[]}
              onAdd={(posX, posY) =>
                setDraft((d) => ({
                  ...d,
                  damages: [...d.damages, { id: newId(), posX, posY, description: "" }],
                }))
              }
              onRemove={(id) =>
                setDraft((d) => ({ ...d, damages: d.damages.filter((x) => x.id !== id) }))
              }
            />
          </div>
          {draft.damages.map((dm, i) => (
            <div key={dm.id} className="flex flex-col gap-2 rounded-lg border border-foreground/10 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Daño nuevo #{i + 1}</span>
                <button
                  type="button"
                  className="text-xs text-red-600"
                  onClick={() =>
                    setDraft((d) => ({ ...d, damages: d.damages.filter((x) => x.id !== dm.id) }))
                  }
                >
                  Quitar
                </button>
              </div>
              <input
                className="h-10 w-full rounded-lg border border-foreground/15 bg-transparent px-3 text-sm outline-none focus:border-foreground/40"
                placeholder="Descripción (ej. rayón puerta delantera)"
                value={dm.description}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    damages: d.damages.map((x) =>
                      x.id === dm.id ? { ...x, description: e.target.value } : x,
                    ),
                  }))
                }
              />
              {dm.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={dm.photo.preview} alt="" className="h-20 w-20 rounded object-cover" />
              ) : (
                <label className="text-xs text-foreground/60 underline">
                  Agregar foto del daño
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => addPhotos(e.target.files, { damageId: dm.id })}
                  />
                </label>
              )}
            </div>
          ))}
        </div>
      )}

      {/* PASO 3 — Fotos + observaciones */}
      {step === 3 && (
        <div className="flex flex-col gap-4">
          <label className="flex h-11 items-center justify-center gap-2 rounded-lg border border-dashed border-foreground/30 text-sm font-medium">
            + Agregar fotos (frente, atrás, laterales)
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={(e) => addPhotos(e.target.files, "main")}
            />
          </label>
          {draft.photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {draft.photos.map((p) => (
                <div key={p.id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.preview} alt="" className="aspect-square w-full rounded-lg object-cover" />
                  {p.status !== "done" && (
                    <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 text-xs text-white">
                      {p.status === "uploading" ? "Subiendo…" : "Error"}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => patch({ photos: draft.photos.filter((x) => x.id !== p.id) })}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          <TextareaField
            id="observations"
            label="Observaciones"
            value={draft.observations}
            onChange={(e) => patch({ observations: e.target.value })}
            rows={4}
          />
        </div>
      )}

      {/* PASO 4 — Firma */}
      {step === 4 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-foreground/70">{dict.signature.legal}</p>
          <SignatureCanvas ref={sigRef} />
          <div className="flex justify-between">
            <button
              type="button"
              className="text-sm text-foreground/60 underline"
              onClick={() => {
                sigRef.current?.clear();
                patch({ signatureKey: undefined });
              }}
            >
              {dict.signature.clear}
            </button>
          </div>
          <TextField
            id="signerName"
            label={dict.signature.signerName}
            value={draft.signerName}
            onChange={(e) => patch({ signerName: e.target.value })}
          />
        </div>
      )}

      {/* PASO 5 — Resumen */}
      {step === 5 && (
        <div className="flex flex-col gap-3">
          <div className="divide-y divide-foreground/10 rounded-xl border border-foreground/10 px-4">
            <SummaryRow label="Vehículo" value={props.vehicle?.label ?? props.vehicleOptions.find((v) => v.id === draft.vehicleId)?.label ?? "—"} />
            <SummaryRow label="Kilometraje" value={`${Number(draft.km || 0).toLocaleString("es-AR")} km`} />
            <SummaryRow label="Nafta" value={`${draft.fuelLevel}/8`} />
            <SummaryRow label="Fallas checklist" value={String(Object.values(draft.checklist).filter((v) => v === "fail").length)} />
            <SummaryRow label="Daños nuevos" value={String(draft.damages.length)} />
            <SummaryRow label="Fotos" value={String(draft.photos.filter((p) => p.key).length)} />
            <SummaryRow label="Idioma del acta" value={languageLabels[draft.language]} />
          </div>
          {uploading && (
            <p className="text-xs text-amber-600">Esperá a que terminen de subir las fotos…</p>
          )}
          <p className="text-xs text-foreground/50">
            Al guardar, el alquiler pasa a activo y el auto a alquilado. El acta y los
            emails se generan en segundo plano.
          </p>
        </div>
      )}

      <FormError>{error}</FormError>

      {/* Navegación */}
      <div className="flex gap-3 pt-2">
        {step > 0 && (
          <Button type="button" variant="secondary" onClick={back} className="flex-1">
            Atrás
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={next} className="flex-1">
            Siguiente
          </Button>
        ) : (
          <Button type="button" onClick={submit} disabled={saving || uploading} className="flex-1">
            {saving ? "Guardando…" : "Guardar entrega"}
          </Button>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="text-foreground/60">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
