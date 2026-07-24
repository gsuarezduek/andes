import { TextField, TextareaField } from "@/components/ui/fields";
import { extraHourAmount, formatArs } from "@/lib/contract";
import { parseDecimal } from "@/lib/number-input";
import type { StepContext } from "../context";

export function StepCondiciones({ ctx }: { ctx: StepContext }) {
  const { draft, patch, props, priceStr, setPrice, setPay } = ctx;
  return (
    <div className="flex flex-col gap-5">
      {/* Tarifa */}
      <div>
        <p className="mb-2 text-sm font-medium text-foreground/80">Tarifa</p>
        <div className="grid grid-cols-2 gap-3">
          <TextField id="pricing_dailyRate" label="Precio por día" type="text" inputMode="decimal" prefix="$" value={priceStr("dailyRate")} onChange={(e) => setPrice("dailyRate", e.target.value)} />
          <TextField id="pricing_days" label="Cantidad de días" type="number" inputMode="numeric" value={priceStr("days")} onChange={(e) => setPrice("days", e.target.value)} min={0} />
          <TextField id="pricing_extraHourPercent" label="Hora extra (% tarifa)" type="number" inputMode="numeric" value={priceStr("extraHourPercent")} onChange={(e) => setPrice("extraHourPercent", e.target.value)} min={0} />
        </div>
        {(() => {
          const amount = extraHourAmount({
            dailyRate: parseDecimal(draft.pricing.dailyRate as string | undefined),
            extraHourPercent: parseDecimal(draft.pricing.extraHourPercent as string | undefined),
          });
          return amount != null ? (
            <p className="mt-2 text-xs text-foreground/60">
              Hora extra ≈ <span className="font-medium text-foreground/80">{formatArs(amount)}</span> ({draft.pricing.extraHourPercent}% de la tarifa diaria).
            </p>
          ) : null;
        })()}
      </div>

      {/* Franquicia/Garantía: un solo importe (deducible del seguro y garantía tomada). */}
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-foreground/80">Franquicia/Garantía</p>
        <TextField id="pricing_deductible" label="Importe" type="text" inputMode="decimal" prefix="$" value={priceStr("deductible")} onChange={(e) => setPrice("deductible", e.target.value)} />
        <button
          type="button"
          onClick={() => {
            const next = !draft.insuranceUpgrade;
            const ded = next ? props.deductibleReduced : props.deductibleBase;
            patch({ insuranceUpgrade: next });
            if (ded != null) setPrice("deductible", String(ded));
          }}
          className={`w-full rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${draft.insuranceUpgrade ? "border-orange-500 bg-orange-500/15 text-orange-700 dark:text-orange-400" : "border-foreground/25 text-foreground/70"}`}
        >
          {draft.insuranceUpgrade ? "✓ Con mejora de seguro (franquicia reducida)" : "Mejora de seguro"}
        </button>
        {draft.insuranceUpgrade && (
          <p className="text-xs text-foreground/50">Franquicia reducida por la mejora de seguro contratada.</p>
        )}
        <TextareaField id="guaranteeForm" label="Forma de la garantía" hint="Ej. tarjeta de crédito, efectivo, cheque" value={draft.guaranteeForm} onChange={(e) => patch({ guaranteeForm: e.target.value })} rows={2} />
      </div>

      {/* Kilometraje */}
      <div>
        <p className="mb-2 text-sm font-medium text-foreground/80">Kilometraje</p>
        {!draft.unlimitedKm && (
          <div className="grid grid-cols-2 gap-3">
            <TextField id="pricing_kmPerDay" label="Km por día" type="number" inputMode="numeric" value={priceStr("kmPerDay")} onChange={(e) => setPrice("kmPerDay", e.target.value)} min={0} />
            <TextField id="pricing_extraKmRate" label="Km extra (c/u)" type="text" inputMode="decimal" prefix="$" value={priceStr("extraKmRate")} onChange={(e) => setPrice("extraKmRate", e.target.value)} />
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
        <TextField id="pricing_accessoriesAmount" label="Importe" type="text" inputMode="decimal" prefix="$" value={priceStr("accessoriesAmount")} onChange={(e) => setPrice("accessoriesAmount", e.target.value)} />
        <TextareaField id="accessoriesDesc" label="Detalle de accesorios" hint="Ej. silla de bebé, GPS, portaequipaje" value={draft.accessoriesDesc} onChange={(e) => patch({ accessoriesDesc: e.target.value })} rows={2} />
      </div>

      {/* Pago */}
      <div>
        <p className="mb-2 text-sm font-medium text-foreground/80">Pago</p>
        <div className="grid grid-cols-2 gap-3">
          <TextField id="pricing_total" label="Total a pagar" type="text" inputMode="decimal" prefix="$" value={priceStr("total")} onChange={(e) => setPay("total", e.target.value)} />
          <TextField id="pricing_sena" label="Seña" type="text" inputMode="decimal" prefix="$" value={priceStr("sena")} onChange={(e) => setPay("sena", e.target.value)} />
          <TextField id="pricing_paid" label="Paga" type="text" inputMode="decimal" prefix="$" value={priceStr("paid")} onChange={(e) => setPay("paid", e.target.value)} />
          <TextField id="pricing_balance" label="Saldo" hint="Total − Seña − Paga (editable)" type="text" inputMode="decimal" prefix="$" value={priceStr("balance")} onChange={(e) => setPay("balance", e.target.value)} />
        </div>
      </div>

      <p className="text-xs text-foreground/50">Se registran en el acta; Andes no procesa cobros.</p>
    </div>
  );
}
