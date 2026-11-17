import { useState } from "react";
import { formatArs, type RentalPayment } from "@/lib/contract";
import { formatDateTime } from "@/lib/datetime";
import { isLateReturn, lateReturnDetail } from "@/lib/late-return";
import { settlementLate } from "@/lib/settlement";
import { Row } from "@/components/ui/row";
import { TextField } from "@/components/ui/fields";
import { PaymentsEditor } from "../payments-editor";
import { TabBar, NextSectionLink } from "@/components/ui/tabs";
import type { StepContext } from "../context";

const SECTIONS = ["Comparación", "Liquidación"];

/** Solo se monta cuando `props.returnContext` está definido (lo garantiza el llamador). */
export function StepComparacion({ ctx }: { ctx: StepContext }) {
  const { draft, patch, props, maxFuel, kmDriven, fuelDiff, settlement } = ctx;
  const returnContext = props.returnContext!;
  const [section, setSection] = useState(0);
  // El atraso sale de la hora real de devolución declarada, no de cuándo se
  // hace la recepción: el auto puede haber vuelto 2 horas tarde y recibirse 4
  // horas tarde (ver `Draft.returnedAt`).
  const late = settlement ? settlementLate(settlement) : { days: 0, hours: 0 };
  const isLate = isLateReturn(late);
  return (
    <div className="flex flex-col gap-3">
      <TabBar sections={SECTIONS} active={section} onChange={setSection} />

      {section === 0 && (
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
            <Row label="Devolución pactada" value={formatDateTime(returnContext.endAt)} tone={isLate ? "warn" : undefined} />
          </div>

          <TextField
            id="returnedAt"
            label="Volvió el auto"
            type="datetime-local"
            hint="Cuándo llegó el auto, no cuándo se hace esta recepción. De acá sale el cargo por devolución tardía."
            value={draft.returnedAt}
            onChange={(e) => patch({ returnedAt: e.target.value })}
          />

          {isLate && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                ⚠ Devolución tardía: {lateReturnDetail(late)}
              </p>
              <p className="text-sm text-amber-700/80 dark:text-amber-400/80">
                {late.hours > 0
                  ? `Se cobra ${late.days > 0 ? `${late.days} día${late.days === 1 ? "" : "s"} y ` : ""}${late.hours} hora${late.hours === 1 ? "" : "s"} extra`
                  : `Se cobra ${late.days} día${late.days === 1 ? "" : "s"} extra`}
                {settlement && (settlement.lateCharge ?? 0) > 0 && (
                  <> · cargo estimado <span className="font-semibold">{formatArs(settlement.lateCharge ?? 0)}</span></>
                )}
                . Ajustalo en Liquidación.
              </p>
            </div>
          )}
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
          <NextSectionLink onClick={() => setSection(1)} label="Ir a Liquidación" />
        </div>
      )}

      {section === 1 && settlement && (
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

            {(isLate || draft.settlementLateCharge.trim() !== "") && (
              <div className={`flex items-center justify-between gap-3 rounded-lg px-2 py-1 ${isLate ? "bg-amber-500/10" : ""}`}>
                <span className={`text-sm ${isLate ? "font-medium text-amber-700 dark:text-amber-400" : ""}`}>
                  Devolución tardía
                  <span className={isLate ? "text-amber-700/70 dark:text-amber-400/70" : "text-foreground/50"}>
                    {" "}
                    ({lateReturnDetail(late) || "en hora"})
                  </span>
                </span>
                <input
                  className="h-9 w-28 rounded-lg border border-foreground/15 bg-transparent px-2 text-right text-sm outline-none focus:border-foreground/40"
                  type="text"
                  inputMode="decimal"
                  placeholder={String(settlement.lateCharge ?? 0)}
                  value={draft.settlementLateCharge}
                  onChange={(e) => patch({ settlementLateCharge: e.target.value })}
                />
              </div>
            )}

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
            usdRate={props.usdRate}
          />
        </div>
      )}
    </div>
  );
}
