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
import { languageLabels, documentKindLabels } from "@/lib/labels";
import { PRICING_FIELDS, extraHourAmount, formatArs, computeBalance, type ContractPricing } from "@/lib/contract";
import { computeComparison } from "@/lib/comparison";
import { computeSettlement, rollupSettlement, type SettlementMethod } from "@/lib/settlement";
import type { InspectionInput, SaveResult, DocumentKindInput } from "@/lib/inspection-input";
import type { CreateRemoteSignatureResult } from "@/app/(app)/rentals/[id]/remote-sign-actions";

const SETTLEMENT_METHODS: { value: SettlementMethod; label: string }[] = [
  { value: "none", label: "Sin saldo / no aplica" },
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "retencion_deposito", label: "Retención del depósito" },
];

type Lang = "es" | "en";
type Mode = "handover" | "return";
// "queued" = persistida en el dispositivo, esperando señal para subir.
type PhotoItem = { id: string; key?: string; status: "uploading" | "queued" | "done" | "error"; preview: string };
type DamageItem = { id: string; posX: number; posY: number; description: string; photo?: PhotoItem };
// Documento del cliente (licencia/DNI/pasaporte), solo en la entrega. Cuando
// es la licencia de un conductor adicional lleva `holderName` (su nombre).
type DocItem = { id: string; kind: DocumentKindInput; key?: string; status: "uploading" | "queued" | "done" | "error"; preview: string; holderName?: string };
// Conductor adicional autorizado (además del titular).
type DriverItem = { id: string; name: string };

const DOC_KINDS: DocumentKindInput[] = ["license", "dni", "passport"];

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
  // "KM libres": sin límite → no se cobra excedente en la devolución.
  unlimitedKm: boolean;
  accessoriesDesc: string;
  // Forma de la garantía tomada en la entrega (efectivo, tarjeta, etc.).
  guaranteeForm: string;
  km: string;
  fuelLevel: number;
  // Neutral por defecto: cada ítem debe decidirse OK/Falla antes de avanzar.
  checklist: Record<string, "ok" | "fail">;
  damages: DamageItem[];
  photos: PhotoItem[];
  documents: DocItem[];
  additionalDrivers: DriverItem[];
  observations: string;
  signerName: string;
  signatureKey?: string;
  // Id de la firma en la cola de subida mientras no hay señal.
  signaturePendingId?: string;
  // Liquidación (solo devolución). Guardamos los overrides editables; el total
  // se recalcula en vivo desde la comparación + condiciones de la entrega.
  settlementMethod: SettlementMethod;
  settlementNote: string;
  settlementFuelCharge: string;
  settlementExtraKmCharge: string; // vacío = usar el auto-calculado
  settlementDeposit: string; // vacío = usar el depósito del contrato
  damageAmounts: Record<string, string>; // por id de daño
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
  existingDamages: { posX: number; posY: number; description?: string | null }[];
  /** Divisiones del tanque de este vehículo (Vehicle.fuelLevels, 4–16). */
  maxFuel?: number;
  language: Lang;
  licenseExpiry?: string;
  pricing?: Record<string, string>;
  /** custdata de VikRentCar: info de la reserva escrita por el staff (solo lectura). */
  bookingNote?: string;
  returnContext?: { handoverKm: number; handoverFuel: number; pricing?: ContractPricing };
  /** Server action para firma remota (el cliente firma en su propio teléfono). */
  createRemoteSignature?: (input: {
    rentalId: string;
    draftId: string;
    type: Mode;
    language: Lang;
    summary: {
      vehicleLabel: string;
      km: number;
      fuelLevel: number;
      newDamages: string[];
      observations?: string;
      clientName?: string;
      datesLabel?: string;
      conditions?: { label: string; value: string }[];
      settlementRows?: { label: string; value: string }[];
      balanceLabel?: string;
      balanceValue?: string;
    };
  }) => Promise<CreateRemoteSignatureResult>;
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

  const maxFuel = props.maxFuel ?? 8;
  const storageKey = `andes:${props.mode}:${props.rentalId}`;
  const sigRef = useRef<SignaturePadHandle>(null);
  const geo = useRef<{ lat?: number; lng?: number }>({});

  const [step, setStep] = useState(0);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [online, setOnline] = useState(true);
  const [queuedSubmit, setQueuedSubmit] = useState(false);
  // Firma remota (el cliente firma en su propio teléfono).
  const [remote, setRemote] = useState<{ id: string; svg: string; url: string } | null>(null);
  const [remoteStatus, setRemoteStatus] = useState<"idle" | "waiting" | "signed" | "error">("idle");
  const [remoteBusy, setRemoteBusy] = useState(false);
  // El cliente aceptó las condiciones (habilita la firma en este dispositivo).
  const [clientAccepted, setClientAccepted] = useState(false);

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
    unlimitedKm: props.pricing?.unlimitedKm === "true",
    accessoriesDesc: props.pricing?.accessoriesDesc ?? "",
    guaranteeForm: props.pricing?.guaranteeForm ?? "",
    km: props.vehicle ? String(props.vehicle.currentKm) : "",
    // Arranca en 0 (tanque vacío) a propósito: obliga a elegir el nivel real en
    // vez de aceptar un default. Igual criterio en entrega y devolución.
    fuelLevel: 0,
    checklist: {},
    damages: [],
    photos: [],
    documents: [],
    additionalDrivers: [],
    settlementMethod: "none",
    settlementNote: "",
    settlementFuelCharge: "",
    settlementExtraKmCharge: "",
    settlementDeposit: "",
    damageAmounts: {},
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
        const existingDocs = new Set(d.documents.map((doc) => doc.id));
        const newDocs: DocItem[] = [];
        for (const r of recs) {
          if (r.slot.startsWith("damage:")) {
            const damageId = r.slot.slice("damage:".length);
            damages = damages.map((dm) =>
              dm.id === damageId && !dm.photo
                ? { ...dm, photo: { id: r.id, status: "queued" as const, preview: URL.createObjectURL(r.blob) } }
                : dm,
            );
          } else if (r.slot.startsWith("document:") && !existingDocs.has(r.id)) {
            const kind = r.slot.slice("document:".length) as DocumentKindInput;
            newDocs.push({ id: r.id, kind, status: "queued", preview: URL.createObjectURL(r.blob) });
          }
        }
        return { ...d, photos: [...d.photos, ...mainPhotos], damages, documents: [...d.documents, ...newDocs] };
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
          documents: d.documents.map((doc) => (doc.id === e.id ? { ...doc, ...up } : doc)),
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
      documents: draft.documents.filter((doc) => doc.key).map((doc) => ({ ...doc, preview: "" })),
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

  // Helpers de precios (paso "Condiciones").
  const priceStr = (k: string) => draft.pricing[k] ?? "";
  const setPrice = (k: string, v: string) => patch({ pricing: { ...draft.pricing, [k]: v } });
  const numOrUndef = (s?: string) => (s && s.trim() !== "" ? Number(s) : undefined);
  // Al cambiar total/seña/paga, el saldo se autocompleta (editable).
  const setPay = (k: "total" | "sena" | "paid" | "balance", v: string) => {
    const next = { ...draft.pricing, [k]: v };
    if (k !== "balance") {
      const bal = computeBalance({
        total: numOrUndef(next.total),
        sena: numOrUndef(next.sena),
        paid: numOrUndef(next.paid),
      });
      if (bal != null) next.balance = String(bal);
    }
    patch({ pricing: next });
  };

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

  // Captura de un documento del cliente (licencia/DNI/pasaporte). Va por la
  // misma cola persistente, con el tipo codificado en el slot. Solo en la
  // entrega; se guardan como evidencia interna (no van al acta ni al email).
  async function addDocument(files: FileList | null, kind: DocumentKindInput, holderName?: string) {
    if (!files) return;
    for (const file of Array.from(files)) {
      const id = newId();
      const preview = URL.createObjectURL(file);
      const item: DocItem = { id, kind, status: "uploading", preview, holderName };
      setDraft((d) => ({ ...d, documents: [...d.documents, item] }));
      const blob = await compressImage(file);
      void enqueueUpload({ id, draftId: draft.draftId, kind: "document", slot: `document:${kind}`, blob });
    }
  }

  // Hay fotos que todavía no terminaron de subir (subiendo o en cola por señal).
  const photosPending =
    draft.photos.some((p) => p.status !== "done") ||
    draft.damages.some((d) => d.photo && d.photo.status !== "done");

  const current = STEPS[step];
  const comparison = props.returnContext
    ? computeComparison({
        handoverKm: props.returnContext.handoverKm,
        returnKm: Number(draft.km || 0),
        handoverFuel: props.returnContext.handoverFuel,
        returnFuel: draft.fuelLevel,
        newDamages: draft.damages.length,
      })
    : null;
  const kmDriven = comparison?.kmDriven ?? 0;
  const fuelDiff = comparison?.fuelDiff ?? 0;

  // Liquidación en vivo (solo devolución): auto-calculada desde la comparación
  // y las condiciones de la entrega, con los overrides que edita el empleado.
  // Es una función (no un const reactivo) para que `submit` la recalcule sin
  // cerrar sobre un valor reactivo declarado antes del efecto de reintento.
  function buildSettlement() {
    if (!props.returnContext) return null;
    const base = computeSettlement({
      handoverKm: props.returnContext.handoverKm,
      returnKm: Number(draft.km || 0),
      handoverFuel: props.returnContext.handoverFuel,
      returnFuel: draft.fuelLevel,
      pricing: props.returnContext.pricing,
      newDamages: draft.damages.map((d) => ({ description: d.description })),
    });
    const numOr = (s: string, fallback: number) => (s.trim() === "" ? fallback : Number(s) || 0);
    return rollupSettlement({
      ...base,
      extraKmCharge: numOr(draft.settlementExtraKmCharge, base.extraKmCharge),
      fuelCharge: numOr(draft.settlementFuelCharge, 0),
      deposit: numOr(draft.settlementDeposit, base.deposit),
      damageCharges: draft.damages.map((d, i) => ({
        description: d.description.trim() || `Daño #${i + 1}`,
        amount: Number(draft.damageAmounts[d.id] || 0),
      })),
      method: draft.settlementMethod,
      note: draft.settlementNote.trim() || undefined,
    });
  }
  const settlement = buildSettlement();

  /**
   * Condiciones que el cliente lee y acepta al firmar, ya formateadas. Entrega:
   * condiciones económicas (mismo formato que el acta). Devolución: liquidación
   * (km extra, nafta, daños, depósito) + saldo. Se usa tanto para el payload del
   * QR remoto como para mostrarlas en el paso "Firma" (fallback local).
   */
  function summaryConditions(): {
    conditions?: { label: string; value: string }[];
    settlementRows?: { label: string; value: string }[];
    balanceLabel?: string;
    balanceValue?: string;
  } {
    if (isHandover) {
      const p: Record<string, number> = {};
      for (const f of PRICING_FIELDS) {
        const raw = draft.pricing[f.key];
        if (raw != null && String(raw).trim() !== "") {
          const n = Number(raw);
          if (!Number.isNaN(n)) p[f.key] = n;
        }
      }
      const conditions = PRICING_FIELDS.flatMap((f) => {
        // "KM libres": el km incluido y el km extra no aplican.
        if (draft.unlimitedKm && (f.key === "kmPerDay" || f.key === "extraKmRate")) return [];
        const v = p[f.key];
        if (typeof v !== "number") return [];
        const value = f.kind === "money" ? formatArs(v) : f.kind === "percent" ? `${v}%` : String(v);
        return [{ label: f.label, value }];
      });
      if (draft.unlimitedKm) {
        conditions.push({ label: "Kilometraje", value: "Libre (sin cargo por excedente)" });
      }
      const hourAmount = extraHourAmount(p as ContractPricing);
      if (hourAmount != null) {
        conditions.push({ label: dict.acta.extraHourAmount, value: `${formatArs(hourAmount)} / h` });
      }
      if (draft.accessoriesDesc.trim()) {
        conditions.push({ label: dict.acta.accessories, value: draft.accessoriesDesc.trim() });
      }
      if (draft.guaranteeForm.trim()) {
        conditions.push({ label: "Forma de garantía", value: draft.guaranteeForm.trim() });
      }
      return { conditions };
    }
    if (settlement) {
      const st = dict.acta.settlement;
      const rows: { label: string; value: string }[] = [
        {
          label:
            settlement.extraKm > 0
              ? `${st.extraKm} (${settlement.extraKm.toLocaleString("es-AR")} km)`
              : st.extraKm,
          value: formatArs(settlement.extraKmCharge),
        },
        { label: st.fuel, value: formatArs(settlement.fuelCharge) },
        ...settlement.damageCharges.map((d) => ({
          label: `${st.damage}: ${d.description}`,
          value: formatArs(d.amount),
        })),
        { label: st.subtotal, value: formatArs(settlement.subtotal) },
      ];
      if (settlement.depositApplied > 0) {
        rows.push({ label: st.depositApplied, value: formatArs(settlement.depositApplied) });
      }
      const isDue = settlement.balanceDue > 0;
      return {
        settlementRows: rows,
        balanceLabel: isDue ? st.balanceDue : st.depositReturn,
        balanceValue: formatArs(isDue ? settlement.balanceDue : settlement.depositReturn),
      };
    }
    return {};
  }

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
      const pending = props.checklistItems.filter((it) => draft.checklist[it.id] == null);
      if (pending.length > 0) {
        return `Decidí funcional o falla en todos los ítems del checklist (faltan ${pending.length}).`;
      }
    }
    return undefined;
  }

  async function next() {
    const v = validateStep();
    if (v) return setError(v);
    if (current === "Firma") {
      const localDrawn = Boolean(sigRef.current && !sigRef.current.isEmpty());
      if (localDrawn && !clientAccepted) {
        return setError("El cliente debe aceptar las condiciones antes de firmar.");
      }
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

  // Genera el pedido de firma remota y muestra el QR para que lo escanee el
  // cliente. La firma llega por el polling de abajo.
  async function startRemoteSign() {
    if (!props.createRemoteSignature) return;
    setRemoteBusy(true);
    setError(undefined);
    try {
      const summary = {
        vehicleLabel:
          props.vehicle?.label ??
          props.vehicleOptions.find((v) => v.id === draft.vehicleId)?.label ??
          "—",
        km: Number(draft.km || 0),
        fuelLevel: draft.fuelLevel,
        newDamages: draft.damages.map((d, i) => d.description.trim() || `Daño #${i + 1}`),
        observations: draft.observations.trim() || undefined,
        clientName: (draft.signerName || draft.clientName || "").trim() || undefined,
        datesLabel: props.datesLabel,
        ...summaryConditions(),
      };
      const res = await props.createRemoteSignature({
        rentalId: props.rentalId,
        draftId: draft.draftId,
        type: props.mode,
        language: draft.language,
        summary,
      });
      if (res.ok) {
        setRemote({ id: res.id, svg: res.svg, url: res.url });
        setRemoteStatus("waiting");
      } else {
        setError(res.error);
      }
    } catch {
      setError("No se pudo generar el QR de firma. Reintentá.");
    } finally {
      setRemoteBusy(false);
    }
  }

  function cancelRemote() {
    setRemote(null);
    setRemoteStatus("idle");
  }

  // Reintenta el guardado cuando hay conexión y toda la evidencia ya subió.
  useEffect(() => {
    if (queuedSubmit && online && !photosPending && draft.signatureKey && !saving) {
      void submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queuedSubmit, online, photosPending, draft.signatureKey, saving]);

  // Poolea el pedido de firma remota hasta que el cliente firme en su teléfono.
  useEffect(() => {
    if (!remote || remoteStatus !== "waiting") return;
    const iv = setInterval(async () => {
      try {
        const r = await fetch(`/api/sign/${remote.id}/status`, { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as { status: string; signatureKey?: string; signerName?: string };
        if (j.status === "signed" && j.signatureKey) {
          const key = j.signatureKey;
          const signer = j.signerName;
          setDraft((d) => ({
            ...d,
            signatureKey: key,
            signerName: signer || d.signerName,
            signaturePendingId: undefined,
          }));
          setClientAccepted(true);
          setRemoteStatus("signed");
        } else if (j.status === "expired" || j.status === "cancelled") {
          setRemoteStatus("error");
        }
      } catch {
        /* sin red: reintenta en el próximo tick */
      }
    }, 3000);
    return () => clearInterval(iv);
  }, [remote, remoteStatus]);

  async function submit() {
    setError(undefined);
    setQueuedSubmit(false);
    const localDrawn = Boolean(sigRef.current && !sigRef.current.isEmpty());
    if (localDrawn && !clientAccepted) {
      return setError("El cliente debe aceptar las condiciones antes de firmar.");
    }
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
      const pricing: ContractPricing = {};
      for (const f of PRICING_FIELDS) {
        const raw = draft.pricing[f.key];
        if (raw !== undefined && raw !== "") {
          const n = Number(raw);
          if (!Number.isNaN(n)) (pricing as Record<string, number>)[f.key] = n;
        }
      }
      if (draft.unlimitedKm) pricing.unlimitedKm = true;
      if (draft.accessoriesDesc.trim()) pricing.accessoriesDesc = draft.accessoriesDesc.trim();
      if (draft.guaranteeForm.trim()) pricing.guaranteeForm = draft.guaranteeForm.trim();
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
              documents: (() => {
                // holderName en el draft es el id del conductor adicional; al
                // persistir lo traducimos a su nombre (o undefined = titular).
                const driverName = (id?: string) =>
                  id ? draft.additionalDrivers.find((dr) => dr.id === id)?.name.trim() || undefined : undefined;
                const docs = draft.documents
                  .filter((doc) => doc.key)
                  .map((doc) => ({ kind: doc.kind, key: doc.key!, holderName: driverName(doc.holderName) }));
                return docs.length ? docs : undefined;
              })(),
              additionalDrivers: (() => {
                const drivers = draft.additionalDrivers
                  .filter((dr) => dr.name.trim())
                  .map((dr) => ({ name: dr.name.trim() }));
                return drivers.length ? drivers : undefined;
              })(),
            }
          : { settlement: buildSettlement() ?? undefined }),
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

  // Condiciones (o liquidación) + legal que el cliente lee y acepta al firmar
  // en este dispositivo. Mismo contenido que ve por QR.
  const signConditions = summaryConditions();
  const signConditionRows = isHandover ? signConditions.conditions : signConditions.settlementRows;
  const generalParagraphs = [
    ...dict.legal.paragraphs,
    dict.legal.photoConsent,
    dict.legal.jurisdiction,
    dict.legal.acceptance,
  ];

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
          {/* Cliente: solo lectura. Se edita en el detalle del alquiler antes de la entrega. */}
          <div className="rounded-xl border border-foreground/10 p-4 text-sm">
            <p className="font-semibold">{draft.clientName || "—"}</p>
            <p className="text-foreground/60">{draft.clientEmail || "sin email"}</p>
            <p className="text-foreground/60">{draft.clientPhone || "sin teléfono"}</p>
            {draft.clientDocNumber ? <p className="text-foreground/60">Doc: {draft.clientDocNumber}</p> : null}
            <p className="mt-2 text-foreground/60">{props.datesLabel}</p>
            {isHandover && (
              <p className="mt-2 text-xs text-foreground/50">
                ¿Datos incorrectos? Editalos en el detalle del alquiler antes de iniciar la entrega.
              </p>
            )}
          </div>
          {isHandover && props.bookingNote ? (
            <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-3">
              <p className="text-xs font-medium text-foreground/70">Info de la reserva (VikRentCar)</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/80">{props.bookingNote}</p>
            </div>
          ) : null}
          {isHandover && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-foreground/80">Documentos del cliente (opcional)</p>
              <p className="text-xs text-foreground/50">Licencia, DNI o pasaporte. Quedan como respaldo interno; no se envían al cliente ni figuran en el acta.</p>
              <div className="grid grid-cols-3 gap-2">
                {DOC_KINDS.map((kind) => {
                  const docs = draft.documents.filter((doc) => doc.kind === kind && !doc.holderName);
                  return (
                    <div key={kind} className="flex flex-col gap-1.5">
                      <p className="text-center text-xs font-medium text-foreground/70">{documentKindLabels[kind]}</p>
                      <div className="flex gap-1">
                        <label className="flex h-9 flex-1 items-center justify-center rounded-lg border border-dashed border-foreground/30 text-center text-[11px] font-medium" title="Sacar foto">
                          📷
                          <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => addDocument(e.target.files, kind)} />
                        </label>
                        <label className="flex h-9 flex-1 items-center justify-center rounded-lg border border-dashed border-foreground/30 text-center text-[11px] font-medium" title="Elegir del teléfono">
                          🖼️
                          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addDocument(e.target.files, kind)} />
                        </label>
                      </div>
                      {docs.map((doc) => (
                        <div key={doc.id} className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={doc.preview} alt="" className="aspect-square w-full rounded-lg object-cover" />
                          {doc.status !== "done" && (
                            <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 px-1 text-center text-[9px] leading-tight text-white">
                              {doc.status === "uploading" ? "Subiendo…" : "Pendiente"}
                            </span>
                          )}
                          <button type="button" onClick={() => { dropUpload(doc.id); patch({ documents: draft.documents.filter((x) => x.id !== doc.id) }); }} className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white">✕</button>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {isHandover && (
            <TextField id="licenseExpiry" label="Venc. licencia de conducir" type="date" value={draft.licenseExpiry} onChange={(e) => patch({ licenseExpiry: e.target.value })} />
          )}
          {isHandover && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground/80">Conductores adicionales</p>
                <button type="button" className="text-xs font-medium text-foreground/70 underline" onClick={() => patch({ additionalDrivers: [...draft.additionalDrivers, { id: newId(), name: "" }] })}>
                  + Agregar conductor
                </button>
              </div>
              {draft.additionalDrivers.length === 0 ? (
                <p className="text-xs text-foreground/50">Otros conductores autorizados. Sus nombres figuran en el acta; la foto de la licencia queda como respaldo interno.</p>
              ) : null}
              {draft.additionalDrivers.map((dr, i) => {
                const drDocs = draft.documents.filter((doc) => doc.kind === "license" && doc.holderName === dr.id);
                return (
                  <div key={dr.id} className="flex flex-col gap-2 rounded-lg border border-foreground/10 p-3">
                    <div className="flex items-center gap-2">
                      <input
                        className="h-10 flex-1 rounded-lg border border-foreground/15 bg-transparent px-3 text-sm outline-none focus:border-foreground/40"
                        placeholder={`Nombre del conductor #${i + 1}`}
                        value={dr.name}
                        onChange={(e) => patch({ additionalDrivers: draft.additionalDrivers.map((x) => (x.id === dr.id ? { ...x, name: e.target.value } : x)) })}
                      />
                      <button type="button" className="text-xs text-red-600" onClick={() => patch({ additionalDrivers: draft.additionalDrivers.filter((x) => x.id !== dr.id) })}>
                        Quitar
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex h-9 items-center gap-1 rounded-lg border border-dashed border-foreground/30 px-3 text-xs font-medium" title="Sacar foto de la licencia">
                        📷 Licencia
                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => addDocument(e.target.files, "license", dr.id)} />
                      </label>
                      <label className="flex h-9 items-center gap-1 rounded-lg border border-dashed border-foreground/30 px-3 text-xs font-medium" title="Elegir del teléfono">
                        🖼️
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => addDocument(e.target.files, "license", dr.id)} />
                      </label>
                      <div className="flex gap-1">
                        {drDocs.map((doc) => (
                          <div key={doc.id} className="relative h-9 w-9">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={doc.preview} alt="" className="h-9 w-9 rounded object-cover" />
                            {doc.status !== "done" && (
                              <span className="absolute inset-0 flex items-center justify-center rounded bg-black/40 text-[8px] text-white">…</span>
                            )}
                            <button type="button" onClick={() => { dropUpload(doc.id); patch({ documents: draft.documents.filter((x) => x.id !== doc.id) }); }} className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-[9px] text-white">✕</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
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
        <div className="flex flex-col gap-5">
          {/* Tarifa */}
          <div>
            <p className="mb-2 text-sm font-medium text-foreground/80">Tarifa</p>
            <div className="grid grid-cols-2 gap-3">
              <TextField id="pricing_dailyRate" label="Precio por día" type="number" inputMode="numeric" prefix="$" value={priceStr("dailyRate")} onChange={(e) => setPrice("dailyRate", e.target.value)} min={0} />
              <TextField id="pricing_days" label="Cantidad de días" type="number" inputMode="numeric" value={priceStr("days")} onChange={(e) => setPrice("days", e.target.value)} min={0} />
              <TextField id="pricing_insuranceAmount" label="Seguro" type="number" inputMode="numeric" prefix="$" value={priceStr("insuranceAmount")} onChange={(e) => setPrice("insuranceAmount", e.target.value)} min={0} />
              <TextField id="pricing_extraHourPercent" label="Hora extra (% tarifa)" type="number" inputMode="numeric" value={priceStr("extraHourPercent")} onChange={(e) => setPrice("extraHourPercent", e.target.value)} min={0} />
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
          </div>

          {/* Kilometraje */}
          <div>
            <p className="mb-2 text-sm font-medium text-foreground/80">Kilometraje</p>
            {!draft.unlimitedKm && (
              <div className="grid grid-cols-2 gap-3">
                <TextField id="pricing_kmPerDay" label="Km por día" type="number" inputMode="numeric" value={priceStr("kmPerDay")} onChange={(e) => setPrice("kmPerDay", e.target.value)} min={0} />
                <TextField id="pricing_extraKmRate" label="Km extra (c/u)" type="number" inputMode="numeric" prefix="$" value={priceStr("extraKmRate")} onChange={(e) => setPrice("extraKmRate", e.target.value)} min={0} />
              </div>
            )}
            <button
              type="button"
              onClick={() => patch({ unlimitedKm: !draft.unlimitedKm })}
              className={`mt-2 w-full rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${draft.unlimitedKm ? "border-foreground bg-foreground text-background" : "border-foreground/25 text-foreground/70"}`}
            >
              {draft.unlimitedKm ? "✓ KM Libres (sin excedente)" : "KM Libres"}
            </button>
            {draft.unlimitedKm && (
              <p className="mt-1 text-xs text-foreground/50">Sin límite de kilómetros: no se cobra excedente en la devolución.</p>
            )}
          </div>

          {/* Accesorios */}
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-foreground/80">Accesorios</p>
            <TextField id="pricing_accessoriesAmount" label="Importe" type="number" inputMode="numeric" prefix="$" value={priceStr("accessoriesAmount")} onChange={(e) => setPrice("accessoriesAmount", e.target.value)} min={0} />
            <TextareaField id="accessoriesDesc" label="Detalle de accesorios" hint="Ej. silla de bebé, GPS, portaequipaje" value={draft.accessoriesDesc} onChange={(e) => patch({ accessoriesDesc: e.target.value })} rows={2} />
          </div>

          {/* Garantía */}
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-foreground/80">Garantía</p>
            <TextField id="pricing_deposit" label="Monto de la garantía" type="number" inputMode="numeric" prefix="$" value={priceStr("deposit")} onChange={(e) => setPrice("deposit", e.target.value)} min={0} />
            <TextareaField id="guaranteeForm" label="Forma de la garantía" hint="Ej. tarjeta de crédito, efectivo, cheque" value={draft.guaranteeForm} onChange={(e) => patch({ guaranteeForm: e.target.value })} rows={2} />
          </div>

          {/* Pago */}
          <div>
            <p className="mb-2 text-sm font-medium text-foreground/80">Pago</p>
            <div className="grid grid-cols-2 gap-3">
              <TextField id="pricing_total" label="Total a pagar" type="number" inputMode="numeric" prefix="$" value={priceStr("total")} onChange={(e) => setPay("total", e.target.value)} min={0} />
              <TextField id="pricing_sena" label="Seña" type="number" inputMode="numeric" prefix="$" value={priceStr("sena")} onChange={(e) => setPay("sena", e.target.value)} min={0} />
              <TextField id="pricing_paid" label="Paga" type="number" inputMode="numeric" prefix="$" value={priceStr("paid")} onChange={(e) => setPay("paid", e.target.value)} min={0} />
              <TextField id="pricing_balance" label="Saldo" hint="Total − Seña − Paga (editable)" type="number" inputMode="numeric" prefix="$" value={priceStr("balance")} onChange={(e) => setPay("balance", e.target.value)} min={0} />
            </div>
          </div>

          <p className="text-xs text-foreground/50">Se registran en el acta; Andes no procesa cobros.</p>
        </div>
      )}

      {current === "Estado" && (
        <div className="flex flex-col gap-5">
          <TextField id="km" label="Kilometraje actual" type="number" inputMode="numeric" value={draft.km} onChange={(e) => patch({ km: e.target.value })} min={0} hint={props.returnContext ? `Entrega: ${props.returnContext.handoverKm.toLocaleString("es-AR")} km` : undefined} />
          <div>
            <p className="mb-2 text-sm font-medium text-foreground/80">Nivel de nafta</p>
            <FuelSelector value={draft.fuelLevel} onChange={(v) => patch({ fuelLevel: v })} max={maxFuel} />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-foreground/80">Checklist</p>
              {(() => {
                const pending = props.checklistItems.filter((it) => draft.checklist[it.id] == null).length;
                return pending > 0 ? (
                  <span className="text-xs font-medium text-amber-600">Faltan {pending}</span>
                ) : (
                  <span className="text-xs font-medium text-emerald-600">Completo ✓</span>
                );
              })()}
            </div>
            <ul className="flex flex-col gap-2">
              {props.checklistItems.map((it) => {
                const val = draft.checklist[it.id]; // undefined = neutro (a decidir)
                return (
                  <li key={it.id} className={`flex items-center justify-between gap-3 rounded-lg px-2 py-1 ${val == null ? "bg-amber-500/10" : ""}`}>
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
          {props.existingDamages.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                Daños ya registrados ({props.existingDamages.length})
              </p>
              <ul className="mt-1 list-disc pl-4 text-sm text-foreground/70">
                {props.existingDamages.map((d, i) => (
                  <li key={i}>{d.description?.trim() || "Daño sin descripción"}</li>
                ))}
              </ul>
            </div>
          )}
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
            <CompareRow label="Nafta" value={`${props.returnContext.handoverFuel}/${maxFuel} → ${draft.fuelLevel}/${maxFuel}`} tone={fuelDiff < 0 ? "warn" : undefined} />
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
            <p className="text-xs text-amber-600">Devuelve con menos nafta que a la entrega ({fuelDiff}/{maxFuel}).</p>
          )}

          {settlement && (
            <div className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-3">
              <p className="text-sm font-semibold">Liquidación</p>
              <p className="text-xs text-foreground/50">
                Se calcula desde las condiciones de la entrega. Ajustá los importes; Andes no procesa cobros.
              </p>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm">
                    Km extra
                    <span className="text-foreground/50">
                      {" "}
                      {settlement.includedKm > 0
                        ? `(${settlement.extraKm.toLocaleString("es-AR")} sobre ${settlement.includedKm.toLocaleString("es-AR")} incl.)`
                        : "(sin límite pactado)"}
                    </span>
                  </span>
                  <input
                    className="h-9 w-28 rounded-lg border border-foreground/15 bg-transparent px-2 text-right text-sm outline-none focus:border-foreground/40"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder={String(settlement.extraKmCharge)}
                    value={draft.settlementExtraKmCharge}
                    onChange={(e) => patch({ settlementExtraKmCharge: e.target.value })}
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm">
                    Nafta faltante
                    <span className="text-foreground/50"> ({settlement.fuelMissingEighths}/{maxFuel})</span>
                  </span>
                  <input
                    className="h-9 w-28 rounded-lg border border-foreground/15 bg-transparent px-2 text-right text-sm outline-none focus:border-foreground/40"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder="0"
                    value={draft.settlementFuelCharge}
                    onChange={(e) => patch({ settlementFuelCharge: e.target.value })}
                  />
                </div>

                {draft.damages.map((dm, i) => (
                  <div key={dm.id} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-red-600">Daño: {dm.description.trim() || `#${i + 1}`}</span>
                    <input
                      className="h-9 w-28 rounded-lg border border-foreground/15 bg-transparent px-2 text-right text-sm outline-none focus:border-foreground/40"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      placeholder="0"
                      value={draft.damageAmounts[dm.id] ?? ""}
                      onChange={(e) => patch({ damageAmounts: { ...draft.damageAmounts, [dm.id]: e.target.value } })}
                    />
                  </div>
                ))}

                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-foreground/70">Depósito / excedente tomado</span>
                  <input
                    className="h-9 w-28 rounded-lg border border-foreground/15 bg-transparent px-2 text-right text-sm outline-none focus:border-foreground/40"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder={String(settlement.deposit)}
                    value={draft.settlementDeposit}
                    onChange={(e) => patch({ settlementDeposit: e.target.value })}
                  />
                </div>
              </div>

              <div className="divide-y divide-foreground/10 border-t border-foreground/10 pt-1">
                <CompareRow label="Subtotal" value={formatArs(settlement.subtotal)} />
                <CompareRow label="Cubierto por depósito" value={formatArs(settlement.depositApplied)} />
                {settlement.balanceDue > 0 ? (
                  <CompareRow label="Saldo a cobrar" value={formatArs(settlement.balanceDue)} tone="warn" />
                ) : (
                  <CompareRow label="Depósito a devolver" value={formatArs(settlement.depositReturn)} />
                )}
              </div>

              <SelectField id="settlementMethod" label="Cómo se salda" value={draft.settlementMethod} onChange={(e) => patch({ settlementMethod: e.target.value as SettlementMethod })}>
                {SETTLEMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </SelectField>
              <TextareaField id="settlementNote" label="Nota de la liquidación (opcional)" value={draft.settlementNote} onChange={(e) => patch({ settlementNote: e.target.value })} rows={2} />
            </div>
          )}
        </div>
      )}

      {current === "Firma" && (
        <div className="flex flex-col gap-3">
          {/* Condiciones económicas (entrega) o liquidación (devolución). */}
          {signConditionRows && signConditionRows.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-foreground/80">
                {isHandover ? dict.acta.termsTitle : dict.acta.settlement.title}
              </h3>
              <div className="divide-y divide-foreground/10 rounded-xl border border-foreground/10 px-4">
                {signConditionRows.map((r, i) => (
                  <CompareRow key={i} label={r.label} value={r.value} />
                ))}
                {!isHandover && signConditions.balanceLabel && (
                  <CompareRow label={signConditions.balanceLabel} value={signConditions.balanceValue ?? "—"} tone="warn" />
                )}
              </div>
            </section>
          )}

          {/* Condiciones generales (texto legal completo). */}
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-foreground/80">{dict.legal.title}</h3>
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-foreground/10 px-4 py-3 text-xs leading-relaxed text-foreground/70">
              {generalParagraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>

          {/* Aceptación explícita del cliente: habilita la firma local. */}
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-foreground/15 px-4 py-3 text-sm">
            <input type="checkbox" checked={clientAccepted} onChange={(e) => setClientAccepted(e.target.checked)} className="mt-0.5 size-5 shrink-0" />
            <span className="text-foreground/80">{dict.signature.acceptConditions}</span>
          </label>

          <p className="text-sm text-foreground/70">{dict.signature.legal}</p>

          <div className={`flex flex-col gap-3 ${clientAccepted ? "" : "pointer-events-none opacity-50"}`} aria-disabled={!clientAccepted}>
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

          {props.createRemoteSignature && (
            <div className="flex flex-col gap-2 border-t border-foreground/10 pt-3">
              <p className="text-xs font-medium text-foreground/70">¿El cliente prefiere firmar en su teléfono?</p>
              {remoteStatus === "signed" ? (
                <p className="text-sm font-medium text-green-600">Firma del cliente recibida ✓</p>
              ) : !remote ? (
                <Button type="button" variant="secondary" onClick={startRemoteSign} disabled={remoteBusy}>
                  {remoteBusy ? "Generando…" : "Generar QR para el cliente"}
                </Button>
              ) : (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-foreground/10 p-3">
                  {/* SVG del QR generado en el servidor */}
                  <div className="h-44 w-44 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: remote.svg }} />
                  <p className="text-center text-xs text-foreground/60">
                    {remoteStatus === "error"
                      ? "El pedido venció. Generá uno nuevo."
                      : "El cliente escanea este QR y firma en su teléfono. Esperando la firma…"}
                  </p>
                  <button type="button" className="text-xs text-foreground/60 underline" onClick={cancelRemote}>
                    {remoteStatus === "error" ? "Cerrar" : "Cancelar"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {current === "Resumen" && (
        <div className="flex flex-col gap-3">
          <div className="divide-y divide-foreground/10 rounded-xl border border-foreground/10 px-4">
            {isHandover && <CompareRow label="Cliente" value={draft.clientName || "—"} />}
            <CompareRow label="Vehículo" value={props.vehicle?.label ?? props.vehicleOptions.find((v) => v.id === draft.vehicleId)?.label ?? "—"} />
            <CompareRow label="Kilometraje" value={`${Number(draft.km || 0).toLocaleString("es-AR")} km`} />
            <CompareRow label="Nafta" value={`${draft.fuelLevel}/${maxFuel}`} />
            {props.returnContext && <CompareRow label="Km recorridos" value={`${kmDriven.toLocaleString("es-AR")} km`} />}
            {settlement && (
              <CompareRow
                label={settlement.balanceDue > 0 ? "Saldo a cobrar" : "Depósito a devolver"}
                value={formatArs(settlement.balanceDue > 0 ? settlement.balanceDue : settlement.depositReturn)}
                tone={settlement.balanceDue > 0 ? "warn" : undefined}
              />
            )}
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
