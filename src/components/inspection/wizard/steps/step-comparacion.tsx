import { formatArs, type RentalPayment } from "@/lib/contract";
import { Row } from "@/components/ui/row";
import { PaymentsEditor } from "../payments-editor";
import type { StepContext } from "../context";

/** Solo se monta cuando `props.returnContext` está definido (lo garantiza el llamador). */
export function StepComparacion({ ctx }: { ctx: StepContext }) {
  const { draft, patch, props, maxFuel, kmDriven, fuelDiff, settlement } = ctx;
  const returnContext = props.returnContext!;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-foreground/60">Comparación contra la entrega:</p>
      <div className="divide-y divide-foreground/10 rounded-xl border border-foreground/10 px-4">
        <Row
          label="Km recorridos"
          value={`${kmDriven.toLocaleString("es-AR")} km`}
          tone={settlement && settlement.extraKm > 0 ? "warn" : undefined}
        />
        <Row label="Kilometraje" value={`${returnContext.handoverKm.toLocaleString("es-AR")} → ${Number(draft.km || 0).toLocaleString("es-AR")}`} />
        <Row label="Nafta" value={`${returnContext.handoverFuel}/${maxFuel} → ${draft.fuelLevel}/${maxFuel}`} tone={fuelDiff < 0 ? "warn" : undefined} />
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
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
            ⚠ Devuelve con menos nafta que a la entrega
          </p>
          <p className="text-sm text-amber-700/80 dark:text-amber-400/80">
            {returnContext.handoverFuel}/{maxFuel} → {draft.fuelLevel}/{maxFuel} ({Math.abs(fuelDiff)}/{maxFuel} menos)
          </p>
        </div>
      )}

      {settlement && settlement.extraKm > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
            ⚠ Superó el kilometraje incluido
          </p>
          <p className="text-sm text-amber-700/80 dark:text-amber-400/80">
            {settlement.extraKm.toLocaleString("es-AR")} km sobre {settlement.includedKm.toLocaleString("es-AR")} incluidos
            {settlement.extraKmCharge > 0 && (
              <>
                {" "}
                · cargo estimado <span className="font-semibold">{formatArs(settlement.extraKmCharge)}</span>
              </>
            )}
          </p>
        </div>
      )}

      {settlement && (
        <div className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-3">
          <p className="text-sm font-semibold">Liquidación</p>
          <p className="text-xs text-foreground/50">
            Se calcula desde las condiciones de la entrega. Ajustá los importes; Andes no procesa cobros.
          </p>

          <div className="flex flex-col gap-2">
            <div
              className={`flex items-center justify-between gap-3 rounded-lg px-2 py-1 ${settlement.extraKm > 0 ? "bg-amber-500/10" : ""}`}
            >
              <span className={`text-sm ${settlement.extraKm > 0 ? "font-medium text-amber-700 dark:text-amber-400" : ""}`}>
                Km extra
                <span className={settlement.extraKm > 0 ? "text-amber-700/70 dark:text-amber-400/70" : "text-foreground/50"}>
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

            <div
              className={`flex items-center justify-between gap-3 rounded-lg px-2 py-1 ${settlement.fuelMissingEighths > 0 ? "bg-amber-500/10" : ""}`}
            >
              <span className={`text-sm ${settlement.fuelMissingEighths > 0 ? "font-medium text-amber-700 dark:text-amber-400" : ""}`}>
                Nafta faltante
                <span className={settlement.fuelMissingEighths > 0 ? "text-amber-700/70 dark:text-amber-400/70" : "text-foreground/50"}>
                  {" "}
                  ({settlement.fuelMissingEighths}/{maxFuel})
                </span>
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
            <Row label="Subtotal" value={formatArs(settlement.subtotal)} />
            {settlement.depositApplied > 0 && (
              <Row label="Cubierto por depósito (daños)" value={formatArs(settlement.depositApplied)} />
            )}
            {settlement.balanceDue > 0 && (
              <Row label="Saldo a cobrar" value={formatArs(settlement.balanceDue)} tone="warn" />
            )}
            {settlement.depositReturn > 0 && (
              <Row label="Depósito a devolver" value={formatArs(settlement.depositReturn)} />
            )}
          </div>

          <PaymentsEditor
            payments={draft.payments}
            paymentMethods={props.paymentMethods ?? []}
            onAdd={(payment: RentalPayment) => patch({ payments: [...draft.payments, payment] })}
            onRemove={(index) => patch({ payments: draft.payments.filter((_, i) => i !== index) })}
            totalLabel="Cobrado"
          />
        </div>
      )}
    </div>
  );
}
