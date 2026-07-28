"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ServiceIcon } from "@/components/ui/icons";
import { maintenanceTypeLabels } from "@/lib/labels";
import { formatDateInput } from "@/lib/datetime";
import { createMaintenance } from "@/app/(app)/vehicles/[id]/maintenance-actions";

type PaymentMethodOption = { id: string; name: string; requiresNote: boolean };

/**
 * Acceso rápido a "Service / arreglo" desde el detalle de la reserva: registra
 * un ítem de mantenimiento del auto sin cancelar el alquiler ni tocar su
 * estado (a diferencia de ServiceFormSection, que sí lo hace). Mismo form y
 * misma acción (`createMaintenance`) que la ficha del vehículo — si hay
 * costo, pide de dónde sale y queda en Caja como gasto general del negocio.
 *
 * El envío se maneja a mano (en vez de `<form action>` nativo): así el modal
 * se queda abierto mientras la acción corre y sólo se cierra si termina bien
 * — antes se cerraba apenas se apretaba "Agregar registro", sin esperar el
 * resultado, y un error (ej. "falta elegir de dónde sale") quedaba invisible.
 */
export function AddServiceButton({
  vehicleId,
  currentKm,
  paymentMethods,
}: {
  vehicleId: string;
  currentKm: number | null;
  paymentMethods: PaymentMethodOption[];
}) {
  const [open, setOpen] = useState(false);
  const [cost, setCost] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const router = useRouter();
  const selectedMethod = paymentMethods.find((m) => m.id === paymentMethodId);
  const hasCost = cost.trim() !== "" && Number(cost) > 0;

  function openModal() {
    setCost("");
    setPaymentMethodId("");
    setError(undefined);
    setOpen(true);
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(undefined);
    start(async () => {
      try {
        await createMaintenance(vehicleId, formData);
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo guardar el registro.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        title="Cargar service / arreglo"
        aria-label="Cargar service / arreglo"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
      >
        <ServiceIcon />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-xl border border-foreground/10 bg-background p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="mb-4 text-sm font-semibold text-foreground/90">Service / arreglo</p>
            <form onSubmit={submit} className="flex flex-col gap-3">
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
                  <input type="date" name="date" required defaultValue={formatDateInput(new Date())} className="h-10 rounded-lg border border-foreground/15 bg-transparent px-2 text-sm" />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-foreground/70">Km</span>
                  <input type="number" name="km" inputMode="numeric" defaultValue={currentKm ?? ""} className="h-10 rounded-lg border border-foreground/15 bg-transparent px-2 text-sm" />
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
              <p className="text-xs text-foreground/50">
                Esto solo registra el service/arreglo — no cancela ni modifica esta reserva.
              </p>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={pending}>
                  {pending ? "Guardando…" : "Agregar registro"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
