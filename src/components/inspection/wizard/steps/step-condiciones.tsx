import { useState } from "react";
import { TextField, TextareaField } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import {
  extraHourAmount,
  formatArs,
  kmPackKm,
  kmPackAmount,
  paymentAdjustedAmount,
  roundMoney,
  KM_PACK_SIZE,
  KM_PACK_MAX,
  type RentalPayment,
} from "@/lib/contract";
import { parseDecimal } from "@/lib/number-input";
import type { StepContext } from "../context";

export function StepCondiciones({ ctx }: { ctx: StepContext }) {
  const { draft, patch, props, priceStr, setPrice, setPay } = ctx;
  const [packModalOpen, setPackModalOpen] = useState(false);
  const [packQty, setPackQty] = useState("1");
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payMethodId, setPayMethodId] = useState("");
  const [payAmount, setPayAmount] = useState("");

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

  // Pago: "Paga" es la suma de las líneas agregadas (cada una ya ajustada por
  // el % del medio elegido), ya no se tipea a mano.
  const paidTotal = draft.payments.reduce((a, p) => a + p.adjustedAmount, 0);
  const selectedMethod = props.paymentMethods?.find((m) => m.id === payMethodId);

  function syncPaid(payments: RentalPayment[]) {
    const sum = payments.reduce((a, p) => a + p.adjustedAmount, 0);
    setPay("paid", payments.length ? String(roundMoney(sum)) : "");
  }
  function openPayModal() {
    setPayMethodId("");
    setPayAmount("");
    setPayModalOpen(true);
  }
  function confirmPayment() {
    const method = selectedMethod;
    const amount = parseDecimal(payAmount) ?? 0;
    if (!method || amount <= 0) return;
    const payment: RentalPayment = {
      methodId: method.id,
      methodName: method.name,
      adjustmentPercent: method.adjustmentPercent,
      amount,
      adjustedAmount: paymentAdjustedAmount(amount, method.adjustmentPercent),
    };
    const next = [...draft.payments, payment];
    patch({ payments: next });
    syncPaid(next);
    setPayModalOpen(false);
  }
  function removePayment(index: number) {
    const next = draft.payments.filter((_, i) => i !== index);
    patch({ payments: next });
    syncPaid(next);
  }

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
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => patch({ unlimitedKm: !draft.unlimitedKm })}
            className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${draft.unlimitedKm ? "border-foreground bg-foreground text-background" : "border-foreground/25 text-foreground/70"}`}
          >
            {draft.unlimitedKm ? "✓ KM Libres" : "KM Libres"}
          </button>
          <button
            type="button"
            onClick={openPackModal}
            disabled={draft.unlimitedKm}
            className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors disabled:opacity-40 ${packs > 0 ? "border-orange-500 bg-orange-500/15 text-orange-700 dark:text-orange-400" : "border-foreground/25 text-foreground/70"}`}
          >
            {packs > 0 ? `✓ Pack de KM (${packs})` : "Pack de KM"}
          </button>
        </div>
        {draft.unlimitedKm ? (
          <p className="mt-1 text-xs text-foreground/50">Sin límite de kilómetros: no se cobra excedente en la devolución.</p>
        ) : (
          packs > 0 && (
            <p className="mt-1 text-xs text-foreground/60">
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
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground/80">Paga</span>
            <span className="text-sm font-semibold text-foreground">{formatArs(paidTotal)}</span>
          </div>
          {draft.payments.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {draft.payments.map((p, i) => (
                <li key={i} className="flex items-center justify-between gap-2 rounded-lg border border-foreground/10 px-3 py-2 text-sm">
                  <span>
                    {p.methodName}
                    {p.adjustmentPercent ? (
                      <span className="ml-1 text-xs text-foreground/50">
                        ({p.adjustmentPercent > 0 ? "+" : ""}
                        {p.adjustmentPercent}%)
                      </span>
                    ) : null}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{formatArs(p.adjustedAmount)}</span>
                    <button type="button" onClick={() => removePayment(i)} className="text-xs text-red-600">
                      Quitar
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={openPayModal}
            className="rounded-lg border border-foreground/25 px-3 py-2.5 text-sm font-medium text-foreground/70 transition-colors hover:bg-foreground/5"
          >
            + Agregar pago
          </button>
        </div>

        <div className="mt-3">
          <TextField id="pricing_balance" label="Saldo" hint="Total − Seña − Paga (editable)" type="text" inputMode="decimal" prefix="$" value={priceStr("balance")} onChange={(e) => setPay("balance", e.target.value)} />
        </div>
      </div>

      <p className="text-xs text-foreground/50">Se registran en el acta; Andes no procesa cobros.</p>

      {packModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setPackModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-foreground/10 bg-background p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-1 text-sm font-semibold text-foreground/90">Pack de KM</p>
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
          </div>
        </div>
      )}

      {payModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setPayModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-foreground/10 bg-background p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-4 text-sm font-semibold text-foreground/90">Agregar pago</p>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-foreground/80">Medio de pago</span>
              <select
                value={payMethodId}
                onChange={(e) => setPayMethodId(e.target.value)}
                className="h-11 rounded-lg border border-foreground/15 bg-transparent px-3 text-base outline-none focus:border-foreground/40"
              >
                <option value="">Elegir…</option>
                {(props.paymentMethods ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.adjustmentPercent ? ` (${m.adjustmentPercent > 0 ? "+" : ""}${m.adjustmentPercent}%)` : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-3">
              <TextField
                id="pay_amount"
                label="Importe"
                type="text"
                inputMode="decimal"
                prefix="$"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
              />
            </div>
            {selectedMethod?.reference && (
              <p className="mt-2 whitespace-pre-wrap rounded-lg bg-foreground/5 p-2 text-xs text-foreground/70">
                {selectedMethod.reference}
              </p>
            )}
            {selectedMethod && (
              <p className="mt-3 text-sm text-foreground/70">
                Se cobra:{" "}
                <span className="font-semibold text-foreground">
                  {formatArs(paymentAdjustedAmount(parseDecimal(payAmount) ?? 0, selectedMethod.adjustmentPercent))}
                </span>
                {selectedMethod.adjustmentPercent ? (
                  <span className="ml-1 text-xs text-foreground/50">
                    ({selectedMethod.adjustmentPercent > 0 ? "+" : ""}
                    {selectedMethod.adjustmentPercent}% aplicado)
                  </span>
                ) : null}
              </p>
            )}
            <div className="mt-5 flex gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setPayModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={!selectedMethod || !((parseDecimal(payAmount) ?? 0) > 0)}
                onClick={confirmPayment}
              >
                Agregar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
