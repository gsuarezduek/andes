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
import { compressImage, mediaUrl } from "@/lib/client/media";
import {
  enqueueUpload,
  onQueueEvent,
  processQueue,
  pendingForDraft,
  clearDraftUploads,
  dropUpload,
  startAutoRetry,
  type QueueSlot,
} from "@/lib/client/upload-queue";
import { getDictionary } from "@/lib/i18n";
import { languageLabels } from "@/lib/labels";
import { PRICING_FIELDS, extraHourAmount, formatArs } from "@/lib/contract";
import type { InspectionInput, SaveResult } from "@/lib/inspection-input";

type Lang = "es" | "en";
type Mode = "handover" | "return";
// "queued" = persistida en el dispositivo, esperando señal para subir.
type PhotoItem = { id: string; key?: string; status: "uploading" | "queued" | "done" | "error"; preview: string };
type DamageItem = { id: string; posX: number; posY: number; description: string; photo?: PhotoItem };

type Draft = {
  draftId: string;
  vehicleId: string;
  language: Lang;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientDocNumber: string;
  licenseExpiry: string;
  pricing: Record<string, string>;
  km: string;
  fuelLevel: number;
  checklist: Record<string, "ok" | "fail">;
  damages: DamageItem[];
  photos: PhotoItem[];
  observations: string;
  signerName: string;
  signatureKey?: string;
  // Id de la firma en la cola de subida mientras no hay señal.
  signaturePendingId?: string;
};

export type InspectionWizardProps = {
  mode: Mode;
  save: (input: InspectionInput) => Promise<SaveResult>;
  rentalId: string;
  client: { name: string; email: string | null; phone: string | null; dni: string | null };
  datesLabel: string;
  vehicle: { id: string; label: string; currentKm: number } | null;
  vehicleOptions: { id: string; label: string }[];
  checklistItems: { id: string; label: string }[];
  existingDamages: { posX: number; posY: number }[];
  language: Lang;
  licenseExpiry?: string;
  pricing?: Record<string, string>;
  /** custdata de VikRentCar: info de la reserva escrita por el staff (solo lectura). */
  bookingNote?: string;
  returnContext?: { handoverKm: number; handoverFuel: number };
};

function newId() {
  return crypto.randomUUID();
}

export function InspectionWizard(props: InspectionWizardProps) {
  const router = useRouter();
  const isHandover = props.mode === "handover";
  const STEPS = isHandover
    ? ["Datos", "Condiciones", "Estado", "Daños", "Fotos", "Firma", "Resumen"]
    : ["Datos", "Estado", "Daños", "Fotos", "Comparación", "Firma", "Resumen"];

  const storageKey = `andes:${props.mode}:${props.rentalId}`;
  const sigRef = useRef<SignaturePadHandle>(null);
  const geo = useRef<{ lat?: number; lng?: number }>({});

  const [step, setStep] = useState(0);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [online, setOnline] = useState(true);
  const [queuedSubmit, setQueuedSubmit] = useState(false);

  const [draft, setDraft] = useState<Draft>(() => ({
    draftId: newId(),
    vehicleId: props.vehicle?.id ?? "",
    language: props.language,
    clientName: props.client.name,
    clientEmail: props.client.email ?? "",
    clientPhone: props.client.phone ?? "",
    clientDocNumber: props.client.dni ?? "",
    licenseExpiry: props.licenseExpiry ?? "",
    pricing: props.pricing ?? {},
    km: props.vehicle ? String(props.vehicle.currentKm) : "",
    fuelLevel: isHandover ? 8 : (props.returnContext?.handoverFuel ?? 8),
    checklist: Object.fromEntries(props.checklistItems.map((i) => [i.id, "ok"])),
    damages: [],
    photos: [],
    observations: "",
    signerName: props.client.name,
  }));

  useEffect(() => {
    let draftId = draft.draftId;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.draftId) draftId = saved.draftId;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDraft((d) => ({ ...d, ...saved }));
      }
    } catch {
      /* ignorar */
    }
    // Rehidratar fotos que quedaron subiendo (offline) en una sesión previa.
    pendingForDraft(draftId).then((recs) => {
      if (recs.length === 0) return;
      setDraft((d) => {
        const existing = new Set([
          ...d.photos.map((p) => p.id),
          ...d.damages.map((dm) => dm.photo?.id),
        ]);
        const mainPhotos = recs
          .filter((r) => r.slot === "main" && !existing.has(r.id))
          .map((r) => ({ id: r.id, status: "queued" as const, preview: URL.createObjectURL(r.blob) }));
        let damages = d.damages;
        for (const r of recs) {
          if (r.slot.startsWith("damage:")) {
            const damageId = r.slot.slice("damage:".length);
            damages = damages.map((dm) =>
              dm.id === damageId && !dm.photo
                ? { ...dm, photo: { id: r.id, status: "queued" as const, preview: URL.createObjectURL(r.blob) } }
                : dm,
            );
          }
        }
        return { ...d, photos: [...d.photos, ...mainPhotos], damages };
      });
      void processQueue();
    });
    navigator.geolocation?.getCurrentPosition(
      (p) => (geo.current = { lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, timeout: 5000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escuchar la cola de subida y el estado de conexión.
  useEffect(() => {
    const stopRetry = startAutoRetry();
    const off = onQueueEvent((e) => {
      setDraft((d) => {
        // La firma se sube por la misma cola: al terminar, fija la clave.
        if (d.signaturePendingId === e.id) {
          if (e.status === "done") return { ...d, signatureKey: e.key, signaturePendingId: undefined };
          return d;
        }
        const up: Partial<PhotoItem> =
          e.status === "done"
            ? { status: "done", key: e.key, preview: mediaUrl(e.key) }
            : e.status === "uploading"
              ? { status: "uploading" }
              : { status: "queued" };
        return {
          ...d,
          photos: d.photos.map((p) => (p.id === e.id ? { ...p, ...up } : p)),
          damages: d.damages.map((dm) =>
            dm.photo?.id === e.id ? { ...dm, photo: { ...dm.photo, ...up } } : dm,
          ),
        };
      });
    });
    const setConn = () => setOnline(navigator.onLine);
    setConn();
    window.addEventListener("online", setConn);
    window.addEventListener("offline", setConn);
    return () => {
      stopRetry();
      off();
      window.removeEventListener("online", setConn);
      window.removeEventListener("offline", setConn);
    };
  }, []);

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
      /* cuota llena */
    }
  }, [draft, storageKey]);

  const dict = getDictionary(draft.language);
  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  async function addPhotos(files: FileList | null, target: "main" | { damageId: string }) {
    if (!files) return;
    for (const file of Array.from(files)) {
      const id = newId();
      const preview = URL.createObjectURL(file);
      const item: PhotoItem = { id, status: "uploading", preview };
      if (target === "main") setDraft((d) => ({ ...d, photos: [...d.photos, item] }));
      else
        setDraft((d) => ({
          ...d,
          damages: d.damages.map((dm) => (dm.id === target.damageId ? { ...dm, photo: item } : dm)),
        }));
      // Comprimir y encolar: se persiste en el dispositivo y se sube con
      // reintentos. El estado (uploading/queued/done) llega por onQueueEvent.
      const blob = await compressImage(file);
      const slot: QueueSlot = target === "main" ? "main" : `damage:${target.damageId}`;
      void enqueueUpload({
        id,
        draftId: draft.draftId,
        kind: target === "main" ? "photo" : "damage",
        slot,
        blob,
      });
    }
  }

  // Hay fotos que todavía no terminaron de subir (subiendo o en cola por señal).
  const photosPending =
    draft.photos.some((p) => p.status !== "done") ||
    draft.damages.some((d) => d.photo && d.photo.status !== "done");

  const current = STEPS[step];
  const kmDriven = props.returnContext ? Number(draft.km || 0) - props.returnContext.handoverKm : 0;
  const fuelDiff = props.returnContext ? draft.fuelLevel - props.returnContext.handoverFuel : 0;

  function validateStep(): string | undefined {
    if (current === "Datos") {
      if (!draft.vehicleId) return "Asigná un vehículo para continuar.";
      if (isHandover && !draft.clientName.trim()) return "Ingresá el nombre del cliente.";
    }
    if (current === "Estado") {
      if (draft.km === "" || Number(draft.km) < 0) return "Ingresá el kilometraje.";
      if (props.returnContext && Number(draft.km) < props.returnContext.handoverKm) {
        return `El kilometraje no puede ser menor al de entrega (${props.returnContext.handoverKm.toLocaleString("es-AR")} km).`;
      }
    }
    return undefined;
  }

  async function next() {
    const v = validateStep();
    if (v) return setError(v);
    if (current === "Firma") {
      if (!draft.signerName.trim()) return setError("Ingresá la aclaración de la firma.");
      if (!(await captureSignature())) return setError("Falta la firma del cliente.");
    }
    setError(undefined);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }
  function back() {
    setError(undefined);
    setStep((s) => Math.max(0, s - 1));
  }

  /**
   * Captura la firma y la encola (misma cola persistente que las fotos): si hay
   * señal sube al toque, si no queda pendiente y sube al reconectar. Devuelve
   * true si hay una firma (nueva, ya subida, o pendiente).
   */
  async function captureSignature(): Promise<boolean> {
    const pad = sigRef.current;
    if (pad && !pad.isEmpty()) {
      const dataUrl = pad.toDataURL();
      const blob = await (await fetch(dataUrl)).blob();
      const id = newId();
      patch({ signatureKey: undefined, signaturePendingId: id });
      void enqueueUpload({ id, draftId: draft.draftId, kind: "signature", slot: "signature", blob });
      return true;
    }
    return Boolean(draft.signatureKey) || Boolean(draft.signaturePendingId);
  }

  function queueSubmitRetry() {
    // El efecto de más abajo dispara el guardado cuando vuelve la señal y
    // terminaron de subir fotos y firma.
    setQueuedSubmit(true);
  }

  // Reintenta el guardado cuando hay conexión y toda la evidencia ya subió.
  useEffect(() => {
    if (queuedSubmit && online && !photosPending && draft.signatureKey && !saving) {
      void submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queuedSubmit, online, photosPending, draft.signatureKey, saving]);

  async function submit() {
    setError(undefined);
    setQueuedSubmit(false);
    if (!draft.signerName.trim()) return setError("Ingresá la aclaración de la firma.");
    if (!(await captureSignature())) return setError("Falta la firma del cliente.");

    // Necesitamos que fotos y firma estén subidas antes de guardar. Si algo
    // sigue pendiente (típicamente sin señal), encolamos: el efecto reintenta
    // solo cuando todo subió y hay conexión.
    if (photosPending || !draft.signatureKey) {
      if (navigator.onLine && !draft.signatureKey) {
        // Online pero la firma recién se encoló: se guardará en cuanto suba.
        queueSubmitRetry();
        return;
      }
      if (!navigator.onLine) {
        queueSubmitRetry();
        return;
      }
      return setError("Esperá a que terminen de subir las fotos.");
    }
    setSaving(true);
    try {
      const signatureKey = draft.signatureKey;
      if (!signatureKey) {
        setSaving(false);
        return setError("Falta la firma del cliente.");
      }
      const pricing: Record<string, number> = {};
      for (const f of PRICING_FIELDS) {
        const raw = draft.pricing[f.key];
        if (raw !== undefined && raw !== "") {
          const n = Number(raw);
          if (!Number.isNaN(n)) pricing[f.key] = n;
        }
      }
      const payload: InspectionInput = {
        rentalId: props.rentalId,
        vehicleId: draft.vehicleId,
        language: draft.language,
        km: Number(draft.km),
        fuelLevel: draft.fuelLevel,
        checklist: draft.checklist,
        observations: draft.observations.trim() || undefined,
        newDamages: draft.damages.map((d) => ({
          view: "top" as const,
          posX: d.posX,
          posY: d.posY,
          description: d.description.trim() || undefined,
          photoKey: d.photo?.key,
        })),
        photoKeys: draft.photos.filter((p) => p.key).map((p) => p.key!),
        signatureKey,
        signerName: draft.signerName.trim(),
        ...(isHandover
          ? {
              clientName: draft.clientName.trim(),
              clientEmail: draft.clientEmail.trim() || undefined,
              clientPhone: draft.clientPhone.trim() || undefined,
              clientDocNumber: draft.clientDocNumber.trim() || undefined,
              licenseExpiry: draft.licenseExpiry || undefined,
              pricing: Object.keys(pricing).length ? pricing : undefined,
            }
          : {}),
        latitude: geo.current.lat,
        longitude: geo.current.lng,
      };
      const res = await props.save(payload);
      if (!res.ok) {
        setSaving(false);
        return setError(res.error);
      }
      await clearDraftUploads(draft.draftId);
      localStorage.removeItem(storageKey);
      router.replace(`/rentals/${props.rentalId}?${isHandover ? "entrega" : "devolucion"}=ok`);
    } catch {
      // Probablemente sin señal (firma o guardado). El borrador queda intacto;
      // se reintenta solo al reconectar. El guard del servidor evita duplicados.
      setSaving(false);
      if (!navigator.onLine) {
        queueSubmitRetry();
        setError(undefined);
      } else {
        setError("No se pudo guardar. Reintentá.");
      }
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {!online && (
        <p className="rounded-lg bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-700 dark:text-amber-400">
          Sin conexión. El borrador y las fotos se guardan en el teléfono y se suben solos al volver la señal.
        </p>
      )}
      <div className="flex items-center gap-1.5">
        {STEPS.map((label, i) => (
          <div key={label} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-foreground" : "bg-foreground/15"}`} />
        ))}
      </div>
      <p className="text-sm text-foreground/60">
        Paso {step + 1} de {STEPS.length} · <span className="font-medium text-foreground">{current}</span>
      </p>

      {current === "Datos" && (
        <div className="flex flex-col gap-4">
          {isHandover ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-foreground/80">Datos del cliente</p>
              <TextField id="clientName" label="Nombre y apellido" value={draft.clientName} onChange={(e) => {
                const name = e.target.value;
                // La aclaración de la firma sigue al nombre mientras no se haya editado a mano.
                patch(draft.signerName === draft.clientName ? { clientName: name, signerName: name } : { clientName: name });
              }} hint="Se usa en el acta y los emails. Verificá contra el documento." />
              <div className="grid grid-cols-2 gap-3">
                <TextField id="clientDocNumber" label="Documento" value={draft.clientDocNumber} onChange={(e) => patch({ clientDocNumber: e.target.value })} />
                <TextField id="clientPhone" label="Teléfono" type="tel" value={draft.clientPhone} onChange={(e) => patch({ clientPhone: e.target.value })} />
              </div>
              <TextField id="clientEmail" label="Email" type="email" value={draft.clientEmail} onChange={(e) => patch({ clientEmail: e.target.value })} hint="Ahí llega el acta firmada." />
              <p className="text-xs text-foreground/50">{props.datesLabel}</p>
              {props.bookingNote ? (
                <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-3">
                  <p className="text-xs font-medium text-foreground/70">Info de la reserva (VikRentCar)</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/80">{props.bookingNote}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-xl border border-foreground/10 p-4 text-sm">
              <p className="font-semibold">{props.client.name}</p>
              <p className="text-foreground/60">{props.client.email ?? "sin email"}</p>
              <p className="text-foreground/60">{props.client.phone ?? "sin teléfono"}</p>
              <p className="mt-2 text-foreground/60">{props.datesLabel}</p>
            </div>
          )}
          {props.vehicle ? (
            <div className="rounded-xl border border-foreground/10 p-4 text-sm">
              <span className="text-foreground/60">Vehículo: </span>
              <span className="font-medium">{props.vehicle.label}</span>
            </div>
          ) : (
            <SelectField id="vehicleId" label="Vehículo" hint="Reserva sin unidad asignada" value={draft.vehicleId} onChange={(e) => patch({ vehicleId: e.target.value })}>
              <option value="">Elegir vehículo…</option>
              {props.vehicleOptions.map((v) => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </SelectField>
          )}
          <SelectField id="language" label="Idioma del cliente" hint="Para el acta y los emails" value={draft.language} onChange={(e) => patch({ language: e.target.value as Lang })}>
            {Object.entries(languageLabels).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </SelectField>
        </div>
      )}

      {current === "Condiciones" && (
        <div className="flex flex-col gap-4">
          <TextField id="licenseExpiry" label="Venc. licencia de conducir" type="date" value={draft.licenseExpiry} onChange={(e) => patch({ licenseExpiry: e.target.value })} />
          <div>
            <p className="mb-2 text-sm font-medium text-foreground/80">Condiciones económicas (opcional)</p>
            <div className="grid grid-cols-2 gap-3">
              {PRICING_FIELDS.map((f) => (
                <TextField key={f.key} id={`pricing_${f.key}`} label={f.label} type="number" inputMode="numeric" value={draft.pricing[f.key] ?? ""} onChange={(e) => patch({ pricing: { ...draft.pricing, [f.key]: e.target.value } })} min={0} />
              ))}
            </div>
            {(() => {
              const amount = extraHourAmount({
                dailyRate: Number(draft.pricing.dailyRate) || undefined,
                extraHourPercent: Number(draft.pricing.extraHourPercent) || undefined,
              });
              return amount != null ? (
                <p className="mt-2 text-xs text-foreground/60">
                  Hora extra ≈ <span className="font-medium text-foreground/80">{formatArs(amount)}</span> ({draft.pricing.extraHourPercent}% de la tarifa diaria).
                </p>
              ) : null;
            })()}
            <p className="mt-2 text-xs text-foreground/50">Se registran en el acta; Andes no procesa cobros.</p>
          </div>
        </div>
      )}

      {current === "Estado" && (
        <div className="flex flex-col gap-5">
          <TextField id="km" label="Kilometraje actual" type="number" inputMode="numeric" value={draft.km} onChange={(e) => patch({ km: e.target.value })} min={0} hint={props.returnContext ? `Entrega: ${props.returnContext.handoverKm.toLocaleString("es-AR")} km` : undefined} />
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
                        <button key={opt} type="button" onClick={() => patch({ checklist: { ...draft.checklist, [it.id]: opt } })} className={`px-3 py-1.5 font-medium ${val === opt ? (opt === "ok" ? "bg-green-600 text-white" : "bg-red-600 text-white") : "text-foreground/60"}`}>
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

      {current === "Daños" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-foreground/60">
            Tocá el croquis para marcar un daño nuevo. Los <span className="text-amber-600">ámbar</span> ya estaban registrados.
          </p>
          <div className="mx-auto w-full max-w-[240px]">
            <Croquis existing={props.existingDamages} markers={draft.damages as Marker[]} onAdd={(posX, posY) => setDraft((d) => ({ ...d, damages: [...d.damages, { id: newId(), posX, posY, description: "" }] }))} onRemove={(id) => setDraft((d) => ({ ...d, damages: d.damages.filter((x) => x.id !== id) }))} />
          </div>
          {draft.damages.map((dm, i) => (
            <div key={dm.id} className="flex flex-col gap-2 rounded-lg border border-foreground/10 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Daño nuevo #{i + 1}</span>
                <button type="button" className="text-xs text-red-600" onClick={() => setDraft((d) => ({ ...d, damages: d.damages.filter((x) => x.id !== dm.id) }))}>Quitar</button>
              </div>
              <input className="h-10 w-full rounded-lg border border-foreground/15 bg-transparent px-3 text-sm outline-none focus:border-foreground/40" placeholder="Descripción (ej. rayón puerta delantera)" value={dm.description} onChange={(e) => setDraft((d) => ({ ...d, damages: d.damages.map((x) => (x.id === dm.id ? { ...x, description: e.target.value } : x)) }))} />
              {dm.photo ? (
                <div className="relative h-20 w-20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={dm.photo.preview} alt="" className="h-20 w-20 rounded object-cover" />
                  {dm.photo.status !== "done" && (
                    <span className="absolute inset-0 flex items-center justify-center rounded bg-black/40 px-1 text-center text-[9px] leading-tight text-white">
                      {dm.photo.status === "uploading" ? "Subiendo…" : "Pendiente"}
                    </span>
                  )}
                </div>
              ) : (
                <label className="text-xs text-foreground/60 underline">
                  Agregar foto del daño
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => addPhotos(e.target.files, { damageId: dm.id })} />
                </label>
              )}
            </div>
          ))}
        </div>
      )}

      {current === "Fotos" && (
        <div className="flex flex-col gap-4">
          <label className="flex h-11 items-center justify-center gap-2 rounded-lg border border-dashed border-foreground/30 text-sm font-medium">
            + Agregar fotos (frente, atrás, laterales)
            <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => addPhotos(e.target.files, "main")} />
          </label>
          {draft.photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {draft.photos.map((p) => (
                <div key={p.id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.preview} alt="" className="aspect-square w-full rounded-lg object-cover" />
                  {p.status !== "done" && (
                    <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 px-1 text-center text-[10px] leading-tight text-white">
                      {p.status === "uploading" ? "Subiendo…" : "Pendiente de señal"}
                    </span>
                  )}
                  <button type="button" onClick={() => { dropUpload(p.id); patch({ photos: draft.photos.filter((x) => x.id !== p.id) }); }} className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white">✕</button>
                </div>
              ))}
            </div>
          )}
          <TextareaField id="observations" label="Observaciones" value={draft.observations} onChange={(e) => patch({ observations: e.target.value })} rows={4} />
        </div>
      )}

      {current === "Comparación" && props.returnContext && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-foreground/60">Comparación contra la entrega:</p>
          <div className="divide-y divide-foreground/10 rounded-xl border border-foreground/10 px-4">
            <CompareRow label="Km recorridos" value={`${kmDriven.toLocaleString("es-AR")} km`} />
            <CompareRow label="Kilometraje" value={`${props.returnContext.handoverKm.toLocaleString("es-AR")} → ${Number(draft.km || 0).toLocaleString("es-AR")}`} />
            <CompareRow label="Nafta" value={`${props.returnContext.handoverFuel}/8 → ${draft.fuelLevel}/8`} tone={fuelDiff < 0 ? "warn" : undefined} />
          </div>
          <div className={`rounded-xl border p-3 ${draft.damages.length > 0 ? "border-red-500/40 bg-red-500/5" : "border-foreground/10"}`}>
            <p className="text-sm font-semibold">
              Daños nuevos: {draft.damages.length}
            </p>
            {draft.damages.length > 0 && (
              <ul className="mt-1 list-disc pl-4 text-sm text-red-600">
                {draft.damages.map((d, i) => (
                  <li key={d.id}>{d.description.trim() || `Daño #${i + 1}`}</li>
                ))}
              </ul>
            )}
          </div>
          {fuelDiff < 0 && (
            <p className="text-xs text-amber-600">Devuelve con menos nafta que a la entrega ({fuelDiff}/8).</p>
          )}
        </div>
      )}

      {current === "Firma" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-foreground/70">{dict.signature.legal}</p>
          <SignatureCanvas ref={sigRef} />
          <div className="flex justify-between">
            <button type="button" className="text-sm text-foreground/60 underline" onClick={() => { sigRef.current?.clear(); if (draft.signaturePendingId) dropUpload(draft.signaturePendingId); patch({ signatureKey: undefined, signaturePendingId: undefined }); }}>
              {dict.signature.clear}
            </button>
          </div>
          {draft.signatureKey ? (
            <p className="text-xs text-green-600">Firma registrada. Volvé a firmar para reemplazarla.</p>
          ) : draft.signaturePendingId ? (
            <p className="text-xs text-amber-600">Firma tomada; se subirá al volver la señal.</p>
          ) : null}
          <TextField id="signerName" label={dict.signature.signerName} value={draft.signerName} onChange={(e) => patch({ signerName: e.target.value })} />
        </div>
      )}

      {current === "Resumen" && (
        <div className="flex flex-col gap-3">
          <div className="divide-y divide-foreground/10 rounded-xl border border-foreground/10 px-4">
            {isHandover && <CompareRow label="Cliente" value={draft.clientName || "—"} />}
            <CompareRow label="Vehículo" value={props.vehicle?.label ?? props.vehicleOptions.find((v) => v.id === draft.vehicleId)?.label ?? "—"} />
            <CompareRow label="Kilometraje" value={`${Number(draft.km || 0).toLocaleString("es-AR")} km`} />
            <CompareRow label="Nafta" value={`${draft.fuelLevel}/8`} />
            {props.returnContext && <CompareRow label="Km recorridos" value={`${kmDriven.toLocaleString("es-AR")} km`} />}
            <CompareRow label="Fallas checklist" value={String(Object.values(draft.checklist).filter((v) => v === "fail").length)} />
            <CompareRow label="Daños nuevos" value={String(draft.damages.length)} />
            <CompareRow label="Fotos" value={String(draft.photos.filter((p) => p.key).length)} />
            <CompareRow label="Idioma del acta" value={languageLabels[draft.language]} />
          </div>
          {photosPending && (
            <p className="text-xs text-amber-600">
              {online ? "Esperá a que terminen de subir las fotos…" : "Hay fotos pendientes; se subirán al volver la señal."}
            </p>
          )}
          {queuedSubmit && (
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
              {online
                ? "Terminando de subir la evidencia; se guarda solo en cuanto suba. Dejá esta pantalla abierta."
                : "Sin señal. La entrega se guardará automáticamente al reconectar. Podés dejar esta pantalla abierta."}
            </p>
          )}
          <p className="text-xs text-foreground/50">
            {isHandover
              ? "Al guardar, el alquiler pasa a activo y el auto a alquilado."
              : "Al guardar, el alquiler se finaliza y el auto vuelve a disponible."}{" "}
            El acta y los emails se generan en segundo plano.
          </p>
        </div>
      )}

      <FormError>{error}</FormError>

      <div className="flex gap-3 pt-2">
        {step > 0 && (
          <Button type="button" variant="secondary" onClick={back} className="flex-1">Atrás</Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={next} className="flex-1">Siguiente</Button>
        ) : (
          <Button type="button" onClick={submit} disabled={saving || queuedSubmit} className="flex-1">
            {saving ? "Guardando…" : queuedSubmit ? (online ? "Subiendo evidencia…" : "Esperando señal…") : isHandover ? "Guardar entrega" : "Cerrar devolución"}
          </Button>
        )}
      </div>
    </div>
  );
}

function CompareRow({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="text-foreground/60">{label}</span>
      <span className={`text-right font-medium ${tone === "warn" ? "text-amber-600" : ""}`}>{value}</span>
    </div>
  );
}
