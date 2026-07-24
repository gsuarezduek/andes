import { computeSettlement, rollupSettlement, type Settlement } from "@/lib/settlement";
import { parseDecimal } from "@/lib/number-input";
import { PRICING_FIELDS, extraHourAmount, formatArs, type ContractPricing } from "@/lib/contract";
import type { Dictionary } from "@/lib/i18n";
import type { Draft } from "./types";

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
    method: draft.settlementMethod,
    note: draft.settlementNote.trim() || undefined,
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
  return undefined;
}
