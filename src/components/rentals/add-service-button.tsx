"use client";

import { useState, useTransition } from "react";
import { useRouter, unstable_rethrow } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ServiceIcon } from "@/components/ui/icons";
import { markVehicleService } from "@/app/(app)/rentals/[id]/service-actions";
import { MaintenanceFormFields, type PaymentMethodOption } from "@/components/vehicle/maintenance-form-fields";

const SERVICE_TYPES = [
  { value: "service", label: "Service" },
  { value: "repair", label: "Arreglo" },
];

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
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const router = useRouter();

  function openModal() {
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
          <MaintenanceFormFields types={SERVICE_TYPES} currentKm={currentKm} paymentMethods={paymentMethods} />
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
