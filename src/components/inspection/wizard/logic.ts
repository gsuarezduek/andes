import { computeSettlement, rollupSettlement, type Settlement } from "@/lib/settlement";
import { parseDecimal } from "@/lib/number-input";
import { PRICING_FIELDS, extraHourAmount, kmPackAmount, formatArs, roundMoney, type ContractPricing } from "@/lib/contract";
import type { Dictionary } from "@/lib/i18n";
import type { InspectionInput, PendingEvidenceInput } from "@/lib/inspection-input";
import type { Draft, InspectionWizardProps } from "./types";

/**
 * Liquidación en vivo (solo devolución): auto-calculada desde la comparación
 * y las condiciones de la entrega, con los overrides que edita el empleado.
 * Se llama explícitamente donde haga falta (no es un valor memoizado) para que
 * `submit` pueda recalcularla sin depender de un valor cerrado antes de un
 * efecto de reintento.
 */
export function buildSettlement(
  draft: Draft,
  returnContext?: { handoverKm: number; handoverFuel: number; pricing?: ContractPricing },
): Settlement | null {
  if (!returnContext) return null;
  const base = computeSettlement({
    handoverKm: returnContext.handoverKm,
    returnKm: Number(draft.km || 0),
    handoverFuel: returnContext.handoverFuel,
    returnFuel: draft.fuelLevel,
    pricing: returnContext.pricing,
    newDamages: draft.damages.map((d) => ({ description: d.description })),
  });
  const numOr = (s: string, fallback: number) => (s.trim() === "" ? fallback : parseDecimal(s) ?? 0);
  return rollupSettlement({
    ...base,
    extraKmCharge: numOr(draft.settlementExtraKmCharge, base.extraKmCharge),
    fuelCharge: numOr(draft.settlementFuelCharge, 0),
    deposit: numOr(draft.settlementDeposit, base.deposit),
    damageCharges: draft.damages.map((d, i) => ({
      description: d.description.trim() || `Daño #${i + 1}`,
      amount: parseDecimal(draft.damageAmounts[d.id]) ?? 0,
    })),
    payments: draft.payments,
  });
}

export type SummaryConditions = {
  conditions?: { label: string; value: string }[];
  settlementRows?: { label: string; value: string }[];
  balanceRows?: { label: string; value: string }[];
};

/**
 * Condiciones que el cliente lee y acepta al firmar, ya formateadas. Entrega:
 * condiciones económicas (mismo formato que el acta). Devolución: liquidación
 * (km extra, nafta, daños, depósito) + saldo. Se usa tanto para el payload del
 * QR remoto como para mostrarlas en el paso "Firma" (fallback local).
 */
export function summaryConditions(
  draft: Draft,
  isHandover: boolean,
  dict: Dictionary,
  settlement: Settlement | null,
): SummaryConditions {
  if (isHandover) {
    const p: Record<string, number> = {};
    for (const f of PRICING_FIELDS) {
      const raw = draft.pricing[f.key];
      const n = parseDecimal(raw as string | undefined);
      if (n !== undefined) p[f.key] = n;
    }
    const conditions = PRICING_FIELDS.flatMap((f) => {
      // "KM libres": el km incluido y el km extra no aplican.
      if (draft.unlimitedKm && (f.key === "kmPerDay" || f.key === "extraKmRate" || f.key === "kmPacks"))
        return [];
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
    if (!draft.unlimitedKm) {
      const packPrice = parseDecimal(draft.pricing.kmPackPrice as string | undefined);
      const packAmount = kmPackAmount({ kmPacks: p.kmPacks, kmPackPrice: packPrice });
      if (packAmount != null) {
        conditions.push({ label: "Packs de KM (importe)", value: formatArs(packAmount) });
      }
    }
    if (draft.accessoriesDesc.trim()) {
      conditions.push({ label: dict.acta.accessories, value: draft.accessoriesDesc.trim() });
    }
    const dedSummary = parseDecimal(draft.pricing.deductible as string | undefined);
    if (dedSummary !== undefined) {
      const label = draft.insuranceUpgrade
        ? `${dict.acta.deductible} (${dict.acta.insuranceUpgrade})`
        : dict.acta.deductible;
      conditions.push({ label, value: formatArs(dedSummary) });
    }
    if (draft.guaranteeForm.trim()) {
      conditions.push({ label: "Forma de garantía", value: draft.guaranteeForm.trim() });
    }
    for (const pay of draft.payments) {
      const label =
        (pay.adjustmentPercent
          ? `${pay.methodName} (${pay.adjustmentPercent > 0 ? "+" : ""}${pay.adjustmentPercent}%)`
          : pay.methodName) + (pay.note ? ` — ${pay.note}` : "");
      conditions.push({ label, value: formatArs(pay.adjustedAmount) });
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
    const balanceRows: { label: string; value: string }[] = [];
    if (settlement.balanceDue > 0) {
      balanceRows.push({ label: st.balanceDue, value: formatArs(settlement.balanceDue) });
    }
    if (settlement.depositReturn > 0) {
      balanceRows.push({ label: st.depositReturn, value: formatArs(settlement.depositReturn) });
    }
    for (const pay of settlement.payments ?? []) {
      const label =
        (pay.adjustmentPercent
          ? `${pay.methodName} (${pay.adjustmentPercent > 0 ? "+" : ""}${pay.adjustmentPercent}%)`
          : pay.methodName) + (pay.note ? ` — ${pay.note}` : "");
      balanceRows.push({ label, value: formatArs(pay.adjustedAmount) });
    }
    return { settlementRows: rows, balanceRows };
  }
  return {};
}

export function validateStep(
  current: string,
  draft: Draft,
  isHandover: boolean,
  checklistItems: { id: string; label: string }[],
  returnContext?: { handoverKm: number; handoverFuel: number },
): string | undefined {
  if (current === "Datos") {
    if (!draft.vehicleId) return "Asigná un vehículo para continuar.";
    if (isHandover && !draft.clientName.trim()) return "Ingresá el nombre del cliente.";
  }
  if (current === "Estado") {
    if (draft.km === "" || Number(draft.km) < 0) return "Ingresá el kilometraje.";
    if (returnContext && Number(draft.km) < returnContext.handoverKm) {
      return `El kilometraje no puede ser menor al de entrega (${returnContext.handoverKm.toLocaleString("es-AR")} km).`;
    }
    const pending = checklistItems.filter((it) => draft.checklist[it.id] == null);
    if (pending.length > 0) {
      return `Decidí funcional o falla en todos los ítems del checklist (faltan ${pending.length}).`;
    }
  }
  // Evidencia mínima: sin esto, un acta puede terminar siendo puramente
  // declarativa justo en el escenario donde más se necesita (una disputa).
  if (current === "Fotos") {
    if (draft.photos.length === 0) return "Agregá al menos una foto del vehículo para continuar.";
  }
  if (current === "Daños") {
    const missingDescription = draft.damages.filter((d) => !d.description.trim());
    if (missingDescription.length > 0) {
      return draft.damages.length === 1
        ? "Describí el daño marcado en el croquis para continuar."
        : `Describí cada daño marcado en el croquis para continuar (faltan ${missingDescription.length}).`;
    }
  }
  return undefined;
}

/**
 * Arma el payload final que recibe `saveHandover`/`saveReturn` a partir del
 * draft del wizard. `signature` va aparte (ya resuelto por el caller) en vez
 * de leerse de `draft.signatureKey` para dejar explícito que submit ya
 * validó que hay una firma capturada (subida, o localmente pendiente de
 * subir — "avanzar sin señal") antes de llegar acá.
 */
export function buildInspectionPayload(
  draft: Draft,
  props: InspectionWizardProps,
  isHandover: boolean,
  signature: { key?: string; pendingId?: string },
  geo: { lat?: number; lng?: number },
): InspectionInput {
  const pricing: ContractPricing = {};
  for (const f of PRICING_FIELDS) {
    const n = parseDecimal(draft.pricing[f.key] as string | undefined);
    if (n !== undefined) (pricing as Record<string, number>)[f.key] = n;
  }
  if (draft.unlimitedKm) pricing.unlimitedKm = true;
  if (draft.insuranceUpgrade) pricing.insuranceUpgrade = true;
  {
    // Franquicia/Garantía: un solo importe cargado por el empleado, que vale
    // tanto de deducible (acta) como de garantía tomada (liquidación de la
    // devolución, donde solo cubre daños).
    const ded = parseDecimal(draft.pricing.deductible as string | undefined);
    if (ded !== undefined) {
      pricing.deductible = ded;
      pricing.deposit = ded;
    }
  }
  // Precio del pack de KM: no se edita en el wizard (viene de Configuración →
  // Condiciones), pero viaja en `pricing` para poder calcular su importe en
  // el acta y en la liquidación de la devolución.
  {
    const packPrice = parseDecimal(draft.pricing.kmPackPrice as string | undefined);
    if (packPrice !== undefined) pricing.kmPackPrice = packPrice;
  }
  if (draft.accessoriesDesc.trim()) pricing.accessoriesDesc = draft.accessoriesDesc.trim();
  if (draft.guaranteeForm.trim()) pricing.guaranteeForm = draft.guaranteeForm.trim();
  if (draft.payments.length) {
    pricing.payments = draft.payments;
    pricing.paid = roundMoney(draft.payments.reduce((a, p) => a + p.amount, 0));
  }

  // holderName en el draft es el id del conductor adicional; al persistir lo
  // traducimos a su nombre (o undefined = titular).
  const driverName = (id?: string) =>
    id ? draft.additionalDrivers.find((dr) => dr.id === id)?.name.trim() || undefined : undefined;

  // "Avanzar sin señal": todo lo que el empleado ya capturó (foto, firma,
  // documento) pero todavía no terminó de subir a R2 al momento de guardar.
  // `saveHandover`/`saveReturn` no lo descartan — queda anotado para que
  // `attachInspectionEvidence` lo adjunte solo, en segundo plano, a medida
  // que cada ítem termina de subir.
  const pendingEvidence: PendingEvidenceInput[] = [
    ...(!signature.key && signature.pendingId ? [{ kind: "signature" as const, localId: signature.pendingId }] : []),
    ...draft.photos.filter((p) => !p.key).map((p) => ({ kind: "photo" as const, localId: p.id })),
    ...draft.damages
      .filter((d) => d.photo && !d.photo.key)
      .map((d) => ({ kind: "damagePhoto" as const, localId: d.photo!.id, damageId: d.id })),
    ...draft.documents
      .filter((doc) => !doc.key)
      .map((doc) => ({
        kind: "document" as const,
        localId: doc.id,
        docKind: doc.kind,
        holderName: driverName(doc.holderName),
      })),
  ];

  return {
    rentalId: props.rentalId,
    vehicleId: draft.vehicleId,
    language: draft.language,
    km: Number(draft.km),
    fuelLevel: draft.fuelLevel,
    checklist: draft.checklist,
    observations: draft.observations.trim() || undefined,
    newDamages: draft.damages.map((d) => ({
      id: d.id,
      view: "top" as const,
      posX: d.posX,
      posY: d.posY,
      description: d.description.trim() || undefined,
      photoKey: d.photo?.key,
    })),
    photoKeys: draft.photos.filter((p) => p.key).map((p) => p.key!),
    signatureKey: signature.key,
    signerName: draft.signerName.trim(),
    pendingEvidence: pendingEvidence.length ? pendingEvidence : undefined,
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
            const docs = draft.documents
              .filter((doc) => doc.key)
              .map((doc) => ({ kind: doc.kind, key: doc.key!, localId: doc.id, holderName: driverName(doc.holderName) }));
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
    latitude: geo.lat,
    longitude: geo.lng,
  };
}
