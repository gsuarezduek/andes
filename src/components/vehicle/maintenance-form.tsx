"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { maintenanceTypeLabels } from "@/lib/labels";
import { createMaintenance } from "@/app/(app)/vehicles/[id]/maintenance-actions";

type PaymentMethodOption = { id: string; name: string; requiresNote: boolean };

export function MaintenanceForm({
  vehicleId,
  currentKm,
  paymentMethods,
}: {
  vehicleId: string;
  currentKm: number;
  paymentMethods: PaymentMethodOption[];
}) {
  const [cost, setCost] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const selectedMethod = paymentMethods.find((m) => m.id === paymentMethodId);
  const hasCost = cost.trim() !== "" && Number(cost) > 0;

  return (
    <form action={createMaintenance.bind(null, vehicleId)} className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-foreground/70">Tipo</span>
          <select name="type" className="h-10 rounded-lg border border-foreground/15 bg-transparent px-2 text-sm" defaultValue="service">
            {Object.entries(maintenanceTypeLabels).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-foreground/70">Fecha</span>
          <input type="date" name="date" required className="h-10 rounded-lg border border-foreground/15 bg-transparent px-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-foreground/70">Km</span>
          <input type="number" name="km" inputMode="numeric" defaultValue={currentKm} className="h-10 rounded-lg border border-foreground/15 bg-transparent px-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-foreground/70">Costo</span>
          <input
            type="text"
            name="cost"
            inputMode="decimal"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            className="h-10 rounded-lg border border-foreground/15 bg-transparent px-2 text-sm"
          />
        </label>
      </div>
      <input name="place" placeholder="Lugar / taller (opcional)" className="h-10 rounded-lg border border-foreground/15 bg-transparent px-3 text-sm" />
      <input name="description" required placeholder="Descripción (ej. cambio de aceite y filtros)" className="h-10 rounded-lg border border-foreground/15 bg-transparent px-3 text-sm" />
      {hasCost && (
        <>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-foreground/70">De dónde sale</span>
            <select
              name="paymentMethodId"
              required
              value={paymentMethodId}
              onChange={(e) => setPaymentMethodId(e.target.value)}
              className="h-10 rounded-lg border border-foreground/15 bg-transparent px-2 text-sm"
            >
              <option value="" disabled>Elegí un medio de pago</option>
              {paymentMethods.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </label>
          {selectedMethod?.requiresNote && (
            <input
              name="paymentMethodNote"
              required
              placeholder="¿A dónde fue?"
              className="h-10 rounded-lg border border-foreground/15 bg-transparent px-3 text-sm"
            />
          )}
        </>
      )}
      <SubmitButton pendingLabel="Agregando…">Agregar registro</SubmitButton>
    </form>
  );
}
