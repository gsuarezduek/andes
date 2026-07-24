import { SelectField, TextareaField } from "@/components/ui/fields";
import { formatArs } from "@/lib/contract";
import type { SettlementMethod } from "@/lib/settlement";
import { CompareRow } from "../compare-row";
import { SETTLEMENT_METHODS } from "../types";
import type { StepContext } from "../context";

/** Solo se monta cuando `props.returnContext` está definido (lo garantiza el llamador). */
export function StepComparacion({ ctx }: { ctx: StepContext }) {
  const { draft, patch, props, maxFuel, kmDriven, fuelDiff, settlement } = ctx;
  const returnContext = props.returnContext!;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-foreground/60">Comparación contra la entrega:</p>
      <div className="divide-y divide-foreground/10 rounded-xl border border-foreground/10 px-4">
        <CompareRow label="Km recorridos" value={`${kmDriven.toLocaleString("es-AR")} km`} />
        <CompareRow label="Kilometraje" value={`${returnContext.handoverKm.toLocaleString("es-AR")} → ${Number(draft.km || 0).toLocaleString("es-AR")}`} />
        <CompareRow label="Nafta" value={`${returnContext.handoverFuel}/${maxFuel} → ${draft.fuelLevel}/${maxFuel}`} tone={fuelDiff < 0 ? "warn" : undefined} />
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
                type="text"
                inputMode="decimal"
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
                type="text"
                inputMode="decimal"
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
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={draft.damageAmounts[dm.id] ?? ""}
                  onChange={(e) => patch({ damageAmounts: { ...draft.damageAmounts, [dm.id]: e.target.value } })}
                />
              </div>
            ))}

            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-foreground/70">Garantía tomada (cubre daños)</span>
              <input
                className="h-9 w-28 rounded-lg border border-foreground/15 bg-transparent px-2 text-right text-sm outline-none focus:border-foreground/40"
                type="text"
                inputMode="decimal"
                placeholder={String(settlement.deposit)}
                value={draft.settlementDeposit}
                onChange={(e) => patch({ settlementDeposit: e.target.value })}
              />
            </div>
          </div>

          <div className="divide-y divide-foreground/10 border-t border-foreground/10 pt-1">
            <CompareRow label="Subtotal" value={formatArs(settlement.subtotal)} />
            {settlement.depositApplied > 0 && (
              <CompareRow label="Cubierto por depósito (daños)" value={formatArs(settlement.depositApplied)} />
            )}
            {settlement.balanceDue > 0 && (
              <CompareRow label="Saldo a cobrar" value={formatArs(settlement.balanceDue)} tone="warn" />
            )}
            {settlement.depositReturn > 0 && (
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
  );
}
