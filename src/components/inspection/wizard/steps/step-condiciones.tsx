import { useState } from "react";
import { TextField, TextareaField } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ToggleButton } from "@/components/ui/toggle-button";
import {
  extraHourAmount,
  formatArs,
  kmPackKm,
  kmPackAmount,
  computeBalance,
  roundMoney,
  KM_PACK_SIZE,
  KM_PACK_MAX,
  type RentalPayment,
} from "@/lib/contract";
import { parseDecimal } from "@/lib/number-input";
import { PaymentsEditor } from "../payments-editor";
import { TabBar, NextSectionLink } from "@/components/ui/tabs";
import type { StepContext } from "../context";

const SECTIONS = ["Tarifa", "Garantía", "Kilometraje", "Accesorios", "Pago"];

export function StepCondiciones({ ctx }: { ctx: StepContext }) {
  const { draft, patch, props, priceStr, setPrice, setPay } = ctx;
  const [section, setSection] = useState(0);
  const [packModalOpen, setPackModalOpen] = useState(false);
  const [packQty, setPackQty] = useState("1");

  const packs = parseDecimal(draft.pricing.kmPacks as string | undefined) ?? 0;
  const packPrice = parseDecimal(draft.pricing.kmPackPrice as string | undefined);
  const packAmount = kmPackAmount({ kmPacks: packs, kmPackPrice: packPrice });

  function openPackModal() {
    setPackQty(String(packs > 0 ? packs : 1));
    setPackModalOpen(true);
  }
  function confirmPack() {
    const n = Math.max(1, Math.min(KM_PACK_MAX, Math.round(parseDecimal(packQty) ?? 1)));
    setPrice("kmPacks", String(n));
    setPackModalOpen(false);
  }
  function removePack() {
    setPrice("kmPacks", "");
    setPackModalOpen(false);
  }

  // Alerta (no bloqueante) si el total cargado a mano se aleja mucho del
  // total de la reserva original sincronizado desde VikRentCar — para
  // atajar errores de tipeo (ej. un cero de más), sin impedir cobrar un
  // precio distinto cuando hay una razón real (descuento, recargo, etc.).
  const currentTotal = parseDecimal(draft.pricing.total as string | undefined);
  const bookingTotal = props.bookingTotal;
  const totalDiffWarning =
    currentTotal != null && bookingTotal != null && bookingTotal > 0
      ? Math.abs(currentTotal - bookingTotal) / bookingTotal >= 0.3
        ? { currentTotal, bookingTotal }
        : null
      : null;

  // El recargo/descuento de cada línea de pago (adjustedAmount − amount)
  // también se suma/resta del "Total a pagar", para que el Saldo cierre en
  // $0 en vez de quedar negativo cuando se cobra con un medio con recargo.
  const paymentsSurcharge = draft.payments.reduce((a, p) => a + (p.adjustedAmount - p.amount), 0);

  // Alerta si el Saldo tipeado a mano quedó desalineado de Total − Seña −
  // Paga (el campo se autocompleta al agregar/quitar un pago, pero sigue
  // siendo editable — un valor viejo puede quedar pisado por error).
  const computedBalance = computeBalance({
    total: currentTotal,
    sena: parseDecimal(draft.pricing.sena as string | undefined),
    paid: parseDecimal(draft.pricing.paid as string | undefined),
  });
  const currentBalance = parseDecimal(draft.pricing.balance as string | undefined);
  const balanceMismatch =
    computedBalance != null && currentBalance != null && Math.abs(currentBalance - computedBalance) > 0.01
      ? { currentBalance, computedBalance }
      : null;

  // Aplica en un solo `patch` el nuevo array de pagos + el ajuste de Total y
  // Paga (y recalcula Saldo) — dos `setPay` seguidos pisarían el pricing del
  // otro porque ambos parten del mismo snapshot de `draft.pricing`.
  function applyPayments(nextPayments: RentalPayment[], totalDelta: number) {
    const currentTotal = parseDecimal(draft.pricing.total as string | undefined) ?? 0;
    const nextPaid = roundMoney(nextPayments.reduce((a, p) => a + p.adjustedAmount, 0));
    const nextPricing: Record<string, string> = {
      ...draft.pricing,
      total: String(roundMoney(currentTotal + totalDelta)),
      paid: nextPayments.length ? String(nextPaid) : "",
    };
    const bal = computeBalance({
      total: parseDecimal(nextPricing.total),
      sena: parseDecimal(nextPricing.sena),
      paid: parseDecimal(nextPricing.paid),
    });
    if (bal != null) nextPricing.balance = String(bal);
    patch({ payments: nextPayments, pricing: nextPricing });
  }
  function addPayment(payment: RentalPayment) {
    applyPayments([...draft.payments, payment], payment.adjustedAmount - payment.amount);
  }
  function removePayment(index: number) {
    const removed = draft.payments[index];
    const next = draft.payments.filter((_, i) => i !== index);
    applyPayments(next, -(removed.adjustedAmount - removed.amount));
  }

  return (
    <div className="flex flex-col gap-4">
      <TabBar sections={SECTIONS} active={section} onChange={setSection} />

      {section === 0 && (
        <div className="flex flex-col gap-3">
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
              <p className="text-xs text-foreground/60">
                Hora extra ≈ <span className="font-medium text-foreground/80">{formatArs(amount)}</span> ({draft.pricing.extraHourPercent}% de la tarifa diaria).
              </p>
            ) : null;
          })()}
          <NextSectionLink onClick={() => setSection(1)} />
        </div>
      )}

      {section === 1 && (
        <div className="flex flex-col gap-3">
          <TextField id="pricing_deductible" label="Importe" type="text" inputMode="decimal" prefix="$" value={priceStr("deductible")} onChange={(e) => setPrice("deductible", e.target.value)} />
          <ToggleButton
            active={draft.insuranceUpgrade}
            tone="accent"
            className="w-full"
            onClick={() => {
              const next = !draft.insuranceUpgrade;
              const ded = next ? props.deductibleReduced : props.deductibleBase;
              patch({ insuranceUpgrade: next });
              if (ded != null) setPrice("deductible", String(ded));
            }}
          >
            {draft.insuranceUpgrade ? "✓ Con mejora de seguro (franquicia reducida)" : "Mejora de seguro"}
          </ToggleButton>
          {draft.insuranceUpgrade && (
            <p className="text-xs text-foreground/50">Franquicia reducida por la mejora de seguro contratada.</p>
          )}
          <TextareaField id="guaranteeForm" label="Forma de la garantía" hint="Ej. tarjeta de crédito, efectivo, cheque" value={draft.guaranteeForm} onChange={(e) => patch({ guaranteeForm: e.target.value })} rows={2} />
          <NextSectionLink onClick={() => setSection(2)} />
        </div>
      )}

      {section === 2 && (
        <div className="flex flex-col gap-2">
          {!draft.unlimitedKm && (
            <div className="grid grid-cols-2 gap-3">
              <TextField id="pricing_kmPerDay" label="Km por día" type="number" inputMode="numeric" value={priceStr("kmPerDay")} onChange={(e) => setPrice("kmPerDay", e.target.value)} min={0} />
              <TextField id="pricing_extraKmRate" label="Km extra (c/u)" type="text" inputMode="decimal" prefix="$" value={priceStr("extraKmRate")} onChange={(e) => setPrice("extraKmRate", e.target.value)} />
            </div>
          )}
          <div className="mt-1 grid grid-cols-2 gap-2">
            <ToggleButton active={draft.unlimitedKm} onClick={() => patch({ unlimitedKm: !draft.unlimitedKm })}>
              {draft.unlimitedKm ? "✓ KM Libres" : "KM Libres"}
            </ToggleButton>
            <ToggleButton active={packs > 0} tone="accent" disabled={draft.unlimitedKm} onClick={openPackModal}>
              {packs > 0 ? `✓ Pack de KM (${packs})` : "Pack de KM"}
            </ToggleButton>
          </div>
          {draft.unlimitedKm ? (
            <p className="text-xs text-foreground/50">Sin límite de kilómetros: no se cobra excedente en la devolución.</p>
          ) : (
            packs > 0 && (
              <p className="text-xs text-foreground/60">
                +{kmPackKm({ kmPacks: packs }).toLocaleString("es-AR")} km incluidos
                {packAmount != null ? (
                  <>
                    {" "}
                    · <span className="font-medium text-foreground/80">{formatArs(packAmount)}</span> (sumalo al Total)
                  </>
                ) : null}
                .
              </p>
            )
          )}
          <NextSectionLink onClick={() => setSection(3)} />
        </div>
      )}

      {section === 3 && (
        <div className="flex flex-col gap-3">
          <TextField id="pricing_accessoriesAmount" label="Importe" type="text" inputMode="decimal" prefix="$" value={priceStr("accessoriesAmount")} onChange={(e) => setPrice("accessoriesAmount", e.target.value)} />
          <TextareaField id="accessoriesDesc" label="Detalle de accesorios" hint="Ej. silla de bebé, GPS, portaequipaje" value={draft.accessoriesDesc} onChange={(e) => patch({ accessoriesDesc: e.target.value })} rows={2} />
          <NextSectionLink onClick={() => setSection(4)} label="Ir a Pago" />
        </div>
      )}

      {section === 4 && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <TextField id="pricing_total" label="Total a pagar" type="text" inputMode="decimal" prefix="$" value={priceStr("total")} onChange={(e) => setPay("total", e.target.value)} />
            <TextField id="pricing_sena" label="Seña" type="text" inputMode="decimal" prefix="$" value={priceStr("sena")} onChange={(e) => setPay("sena", e.target.value)} />
          </div>
          {Math.abs(paymentsSurcharge) > 0.001 && (
            <p className="text-xs text-foreground/50">
              Incluye {formatArs(paymentsSurcharge)} de {paymentsSurcharge > 0 ? "recargo" : "descuento"} por medios de pago.
            </p>
          )}
          {totalDiffWarning && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              ⚠ El total cargado ({formatArs(totalDiffWarning.currentTotal)}) difiere bastante del total de la
              reserva original ({formatArs(totalDiffWarning.bookingTotal)}). Revisá que no haya un error de tipeo.
            </p>
          )}

          <PaymentsEditor
            payments={draft.payments}
            paymentMethods={props.paymentMethods ?? []}
            onAdd={addPayment}
            onRemove={removePayment}
            totalLabel="Paga"
          />

          <TextField id="pricing_balance" label="Saldo" hint="Total − Seña − Paga (editable)" type="text" inputMode="decimal" prefix="$" value={priceStr("balance")} onChange={(e) => setPay("balance", e.target.value)} />
          {balanceMismatch && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              ⚠ El saldo cargado ({formatArs(balanceMismatch.currentBalance)}) no coincide con Total − Seña − Paga (
              {formatArs(balanceMismatch.computedBalance)}). Revisá que no haya un error de tipeo.
            </p>
          )}
          <p className="text-xs text-foreground/50">Se registran en el acta; Andes no procesa cobros.</p>
        </div>
      )}

      <Modal open={packModalOpen} onClose={() => setPackModalOpen(false)} title="Pack de KM">
        <p className="mb-4 text-xs text-foreground/50">
          200 km adicionales por pack. Hasta {KM_PACK_MAX} packs.
        </p>
        <TextField
          id="pack_qty"
          label="Cantidad de packs"
          type="number"
          inputMode="numeric"
          min={1}
          max={KM_PACK_MAX}
          value={packQty}
          onChange={(e) => setPackQty(e.target.value)}
        />
        <p className="mt-3 text-sm text-foreground/70">
          {(() => {
            const qty = Math.max(0, Math.round(parseDecimal(packQty) ?? 0));
            const total = kmPackAmount({ kmPacks: qty, kmPackPrice: packPrice });
            return (
              <>
                +{(qty * KM_PACK_SIZE).toLocaleString("es-AR")} km ·{" "}
                <span className="font-semibold text-foreground">
                  {total != null ? formatArs(total) : "—"}
                </span>
              </>
            );
          })()}
        </p>
        <div className="mt-5 flex gap-2">
          {packs > 0 && (
            <Button type="button" variant="danger" onClick={removePack}>
              Quitar
            </Button>
          )}
          <Button type="button" variant="secondary" className="flex-1" onClick={() => setPackModalOpen(false)}>
            Cancelar
          </Button>
          <Button type="button" className="flex-1" onClick={confirmPack}>
            Agregar
          </Button>
        </div>
      </Modal>
    </div>
  );
}
