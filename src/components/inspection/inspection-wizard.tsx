"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FormError } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import type { SignaturePadHandle } from "@/components/inspection/signature-canvas";
import { compressImage, mediaUrl } from "@/lib/client/media";
import {
  enqueueUpload,
  onQueueEvent,
  processQueue,
  pendingForDraft,
  clearDraftUploads,
  startAutoRetry,
  dropUpload,
  type QueueSlot,
} from "@/lib/client/upload-queue";
import { getDictionary } from "@/lib/i18n";
import { PRICING_FIELDS, computeBalance, roundMoney, type ContractPricing } from "@/lib/contract";
import { computeComparison } from "@/lib/comparison";
import { parseDecimal } from "@/lib/number-input";
import type { InspectionInput, DocumentKindInput } from "@/lib/inspection-input";
import { cancelRemoteSignature } from "@/app/(app)/rentals/[id]/remote-sign-actions";
import { newId } from "./wizard/new-id";
import { buildSettlement, summaryConditions, validateStep } from "./wizard/logic";
import type { StepContext } from "./wizard/context";
import type { Draft, PhotoItem, DocItem, InspectionWizardProps } from "./wizard/types";
import { StepDatos } from "./wizard/steps/step-datos";
import { StepCondiciones } from "./wizard/steps/step-condiciones";
import { StepEstado } from "./wizard/steps/step-estado";
import { StepDanos } from "./wizard/steps/step-danos";
import { StepFotos } from "./wizard/steps/step-fotos";
import { StepComparacion } from "./wizard/steps/step-comparacion";
import { StepFirma } from "./wizard/steps/step-firma";
import { StepResumen } from "./wizard/steps/step-resumen";

export type { InspectionWizardProps } from "./wizard/types";

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
  // Lock síncrono contra doble-submit: `saving` recién se pone en true
  // después de un `await` (captura de firma), así que un doble-tap rápido
  // (común en conexión inestable) podía disparar submit() dos veces antes de
  // que el botón se deshabilitara.
  const submittingRef = useRef(false);

  const [step, setStep] = useState(0);
  // Paso más lejano ya visitado: habilita saltar a un paso anterior ya
  // completado tocando la barra de progreso, sin permitir saltar adelante a
  // uno que todavía no se validó.
  const [maxStepReached, setMaxStepReached] = useState(0);
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
    clientAddress: props.client.address ?? "",
    licenseExpiry: props.licenseExpiry ?? "",
    pricing: props.pricing ?? {},
    pricingBaseline: props.pricing ?? {},
    unlimitedKm: props.pricing?.unlimitedKm === "true",
    insuranceUpgrade: props.pricing?.insuranceUpgrade === "true",
    accessoriesDesc: props.pricing?.accessoriesDesc ?? "",
    guaranteeForm: props.pricing?.guaranteeForm ?? "",
    payments: props.initialPayments ?? [],
    km: props.vehicle ? String(props.vehicle.currentKm) : "",
    // Arranca en 0 (tanque vacío) a propósito: obliga a elegir el nivel real en
    // vez de aceptar un default. Igual criterio en entrega y devolución.
    fuelLevel: 0,
    checklist: {},
    damages: [],
    photos: [],
    documents: [],
    additionalDrivers: [],
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
        setDraft((d) => {
          const merged = { ...d, ...saved };
          // No pisar la precarga fresca (dailyRate/days/total/seña, etc.) con
          // un borrador viejo si la reserva cambió en VikRentCar (ej. de 1 a 2
          // días) después de haber abierto el wizard por primera vez. Solo se
          // conservan del borrador los valores de `pricing` que el empleado
          // efectivamente tocó (difieren de la precarga que tenían en ese momento).
          const cachedBaseline: Record<string, string> = saved.pricingBaseline ?? {};
          const cachedPricing: Record<string, string> = saved.pricing ?? {};
          const freshBaseline = d.pricingBaseline;
          const pricing: Record<string, string> = { ...cachedPricing };
          for (const key of new Set([...Object.keys(freshBaseline), ...Object.keys(cachedBaseline)])) {
            const untouched = cachedPricing[key] === cachedBaseline[key];
            if (!untouched) continue;
            if (freshBaseline[key] !== undefined) pricing[key] = freshBaseline[key];
            else delete pricing[key];
          }
          merged.pricing = pricing;
          merged.pricingBaseline = freshBaseline;
          return merged;
        });
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
        // La firma se sube por la misma cola: al terminar, fija la clave. Si
        // se agotaron los reintentos, no se va a resolver sola — hay que
        // volver a firmar (signatureUploadFailed lo habilita en el paso Firma).
        if (d.signaturePendingId === e.id) {
          if (e.status === "done") {
            return { ...d, signatureKey: e.key, signaturePendingId: undefined, signatureUploadFailed: false };
          }
          if (e.status === "error") {
            return { ...d, signaturePendingId: undefined, signatureUploadFailed: true };
          }
          return d;
        }
        const up: Partial<PhotoItem> =
          e.status === "done"
            ? { status: "done", key: e.key, preview: mediaUrl(e.key) }
            : e.status === "uploading"
              ? { status: "uploading" }
              : e.status === "error"
                ? { status: "error" }
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
  const numOrUndef = (s?: string) => parseDecimal(s);
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
  // No cuenta las que ya se dieron por vencidas (status "error"): esas no se
  // van a resolver solas, así que no tiene sentido esperarlas indefinidamente.
  const photosPending =
    draft.photos.some((p) => p.status === "uploading" || p.status === "queued") ||
    draft.damages.some((d) => d.photo && (d.photo.status === "uploading" || d.photo.status === "queued"));
  // Hay al menos una foto que agotó los reintentos automáticos: hace falta
  // que el empleado la saque y la vuelva a cargar (o resuelva lo que esté
  // pasando, ej. reloguearse) — seguir esperando no la va a subir sola.
  const photosFailed =
    draft.photos.some((p) => p.status === "error") ||
    draft.damages.some((d) => d.photo?.status === "error");

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

  // Liquidación en vivo (solo devolución): ver comentario de `buildSettlement`
  // en wizard/logic.ts sobre por qué `submit` la recalcula en vez de reusar esto.
  const settlement = buildSettlement(draft, props.returnContext);

  async function next() {
    const v = validateStep(current, draft, isHandover, props.checklistItems, props.returnContext);
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
    const newStep = Math.min(STEPS.length - 1, step + 1);
    setStep(newStep);
    setMaxStepReached((m) => Math.max(m, newStep));
  }
  const firmaIndex = STEPS.indexOf("Firma");

  /**
   * Salta a cualquier paso ya visitado (barra de progreso clicable) o al
   * anterior/siguiente inmediato (botones Atrás/Siguiente). Nunca permite
   * saltar a un paso más allá de `maxStepReached` (todavía no validado).
   * Si el destino queda antes de "Firma" y ya había una firma (local o
   * remota) hecha, se invalida — quedó atada a datos que se van a poder
   * editar de nuevo — y se recorta `maxStepReached` para forzar volver a
   * pasar por "Firma" (re-firmar) antes de poder llegar de nuevo al Resumen.
   */
  function goToStep(target: number) {
    const clamped = Math.max(0, Math.min(STEPS.length - 1, target));
    if (clamped === step || clamped > maxStepReached) return;
    if (clamped < firmaIndex && step >= firmaIndex) {
      const hadSignature =
        Boolean(draft.signatureKey) || Boolean(draft.signaturePendingId) || remoteStatus !== "idle";
      if (hadSignature) {
        sigRef.current?.clear();
        if (draft.signaturePendingId) dropUpload(draft.signaturePendingId);
        if (remote) void cancelRemoteSignature(remote.id);
        patch({ signatureKey: undefined, signaturePendingId: undefined, signatureUploadFailed: false });
        setClientAccepted(false);
        setRemote(null);
        setRemoteStatus("idle");
        setError("Volviste a editar datos: la firma anterior se invalidó. El cliente va a tener que firmar de nuevo.");
        setMaxStepReached(clamped);
        setStep(clamped);
        return;
      }
    }
    setError(undefined);
    setStep(clamped);
  }
  function back() {
    goToStep(step - 1);
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
      patch({ signatureKey: undefined, signaturePendingId: id, signatureUploadFailed: false });
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
        maxFuel,
        newDamages: draft.damages.map((d, i) => d.description.trim() || `Daño #${i + 1}`),
        observations: draft.observations.trim() || undefined,
        clientName: (draft.signerName || draft.clientName || "").trim() || undefined,
        datesLabel: props.datesLabel,
        ...summaryConditions(draft, isHandover, dict, settlement),
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
    // Best-effort: si el cliente ya tiene la página de firma abierta, que no
    // pueda firmar un pedido que el empleado ya dio por cancelado.
    if (remote) void cancelRemoteSignature(remote.id);
    setRemote(null);
    setRemoteStatus("idle");
  }

  // Reintenta el guardado cuando hay conexión y toda la evidencia ya subió.
  // También dispara si algo se dio por vencido (foto o firma agotaron los
  // reintentos automáticos) mientras esperábamos: submit() ya sabe mostrar el
  // error correspondiente en vez de guardar, así que no se queda esperando en
  // silencio para siempre.
  useEffect(() => {
    if (!queuedSubmit || saving) return;
    if (photosFailed || draft.signatureUploadFailed) {
      void submit();
      return;
    }
    if (online && !photosPending && draft.signatureKey) {
      void submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queuedSubmit, online, photosPending, draft.signatureKey, saving, photosFailed, draft.signatureUploadFailed]);

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
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      await submitImpl();
    } finally {
      submittingRef.current = false;
    }
  }

  async function submitImpl() {
    setError(undefined);
    setQueuedSubmit(false);
    const localDrawn = Boolean(sigRef.current && !sigRef.current.isEmpty());
    if (localDrawn && !clientAccepted) {
      return setError("El cliente debe aceptar las condiciones antes de firmar.");
    }
    if (!draft.signerName.trim()) return setError("Ingresá la aclaración de la firma.");
    if (!(await captureSignature())) return setError("Falta la firma del cliente.");

    // Si alguna foto o la firma ya agotaron los reintentos automáticos, no
    // sirve encolar y esperar — no se van a subir solas.
    if (photosFailed) {
      return setError("Una foto no se pudo subir. Borrala (✕) y volvé a sacarla, o revisá la conexión.");
    }
    if (draft.signatureUploadFailed) {
      return setError("La firma no se pudo subir. Volvé a firmar.");
    }
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
        const n = parseDecimal(draft.pricing[f.key] as string | undefined);
        if (n !== undefined) (pricing as Record<string, number>)[f.key] = n;
      }
      if (draft.unlimitedKm) pricing.unlimitedKm = true;
      if (draft.insuranceUpgrade) pricing.insuranceUpgrade = true;
      {
        // Franquicia/Garantía: un solo importe cargado por el empleado, que
        // vale tanto de deducible (acta) como de garantía tomada (liquidación
        // de la devolución, donde solo cubre daños).
        const ded = parseDecimal(draft.pricing.deductible as string | undefined);
        if (ded !== undefined) {
          pricing.deductible = ded;
          pricing.deposit = ded;
        }
      }
      // Precio del pack de KM: no se edita en el wizard (viene de Configuración
      // → Condiciones), pero viaja en `pricing` para poder calcular su importe
      // en el acta y en la liquidación de la devolución.
      {
        const packPrice = parseDecimal(draft.pricing.kmPackPrice as string | undefined);
        if (packPrice !== undefined) pricing.kmPackPrice = packPrice;
      }
      if (draft.accessoriesDesc.trim()) pricing.accessoriesDesc = draft.accessoriesDesc.trim();
      if (draft.guaranteeForm.trim()) pricing.guaranteeForm = draft.guaranteeForm.trim();
      if (draft.payments.length) {
        pricing.payments = draft.payments;
        pricing.paid = roundMoney(draft.payments.reduce((a, p) => a + p.adjustedAmount, 0));
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
              clientAddress: draft.clientAddress.trim() || undefined,
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
          : { settlement: buildSettlement(draft, props.returnContext) ?? undefined }),
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
  const signConditions = summaryConditions(draft, isHandover, dict, settlement);
  const signConditionRows = isHandover ? signConditions.conditions : signConditions.settlementRows;
  const generalParagraphs = [
    ...dict.legal.paragraphs,
    dict.legal.photoConsent,
    dict.legal.jurisdiction,
    dict.legal.acceptance,
  ];

  const ctx: StepContext = {
    props,
    draft,
    setDraft,
    patch,
    dict,
    isHandover,
    maxFuel,
    addPhotos,
    addDocument,
    priceStr,
    setPrice,
    setPay,
    kmDriven,
    fuelDiff,
    settlement,
    signConditionRows,
    generalParagraphs,
    clientAccepted,
    setClientAccepted,
    sigRef,
    remote,
    remoteStatus,
    remoteBusy,
    startRemoteSign,
    cancelRemote,
    photosPending,
    online,
    queuedSubmit,
  };

  return (
    <div className="flex flex-col gap-5">
      {!online && (
        <p className="rounded-lg bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-700 dark:text-amber-400">
          Sin conexión. El borrador y las fotos se guardan en el teléfono y se suben solos al volver la señal.
        </p>
      )}
      <div className="flex items-center gap-1.5">
        {STEPS.map((label, i) => {
          const reachable = i !== step && i <= maxStepReached;
          return (
            <button
              key={label}
              type="button"
              disabled={!reachable}
              onClick={() => goToStep(i)}
              aria-label={`Ir al paso ${i + 1} de ${STEPS.length}: ${label}`}
              aria-current={i === step ? "step" : undefined}
              className={`flex-1 py-2 ${reachable ? "cursor-pointer hover:opacity-70" : "cursor-default"}`}
            >
              <span className={`block h-1.5 rounded-full ${i <= step ? "bg-foreground" : "bg-foreground/15"}`} />
            </button>
          );
        })}
      </div>
      <p className="text-sm text-foreground/60">
        Paso {step + 1} de {STEPS.length} · <span className="font-medium text-foreground">{current}</span>
      </p>

      {current === "Datos" && <StepDatos ctx={ctx} />}
      {current === "Condiciones" && <StepCondiciones ctx={ctx} />}
      {current === "Estado" && <StepEstado ctx={ctx} />}
      {current === "Daños" && <StepDanos ctx={ctx} />}
      {current === "Fotos" && <StepFotos ctx={ctx} />}
      {current === "Comparación" && props.returnContext && <StepComparacion ctx={ctx} />}
      {current === "Firma" && <StepFirma ctx={ctx} />}
      {current === "Resumen" && <StepResumen ctx={ctx} />}

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
