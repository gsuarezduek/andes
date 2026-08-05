"use client";

import { useState, useTransition } from "react";
import { useRouter, unstable_rethrow } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ServiceIcon } from "@/components/ui/icons";
import { formatDateInput } from "@/lib/datetime";
import { markVehicleService } from "@/app/(app)/rentals/[id]/service-actions";

type PaymentMethodOption = { id: string; name: string; requiresNote: boolean };

/**
 * Única acción de "Service / arreglo" desde el detalle de la reserva: para
 * alquileres cargados solo para bloquear el auto (reservado, sin entrega
 * hecha), registra el service/arreglo, cancela esta reserva placeholder y
 * deja el auto fuera de servicio. Antes había dos botones con el mismo
 * nombre y consecuencias opuestas (este solo registraba, el de más abajo
 * bloqueaba); se unificaron en esta única acción.
 *
 * El envío se maneja a mano (en vez de `<form action>` nativo): así el modal
 * se queda abierto mientras la acción corre y sólo se cierra si termina bien
 * — antes se cerraba apenas se apretaba el botón, sin esperar el resultado,
 * y un error (ej. "falta elegir de dónde sale") quedaba invisible.
 */
export function AddServiceButton({
  rentalId,
  vehicleId,
  currentKm,
  paymentMethods,
}: {
  rentalId: string;
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
        await markVehicleService(rentalId, vehicleId, formData);
        setOpen(false);
        router.refresh();
      } catch (err) {
        // markVehicleService redirige al terminar bien: ese error interno de
        // Next tiene que propagarse, no mostrarse como un fallo real.
        unstable_rethrow(err);
        setError(err instanceof Error ? err.message : "No se pudo guardar el registro.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        title="Marcar service / arreglo (cancela esta reserva y bloquea el auto)"
        aria-label="Marcar service / arreglo (cancela esta reserva y bloquea el auto)"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
      >
        <ServiceIcon />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Service / arreglo">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-foreground/70">Tipo</span>
              <select name="type" className="h-10 rounded-lg border border-foreground/15 bg-transparent px-2 text-sm" defaultValue="service">
                <option value="service">Service</option>
                <option value="repair">Arreglo</option>
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
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Esto cancela esta reserva y deja el auto <strong>fuera de servicio</strong>. Cuando
            vuelva, reactivalo desde su ficha.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={pending}>
              {pending ? "Guardando…" : "Marcar fuera de servicio"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
