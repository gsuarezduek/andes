"use client";

import { useState, useTransition } from "react";
import { useRouter, unstable_rethrow } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { TextField, SelectField } from "@/components/ui/fields";
import { ServiceIcon } from "@/components/ui/icons";
import { formatDateInput } from "@/lib/datetime";
import { markVehicleService, returnVehicleFromService } from "@/app/(app)/rentals/[id]/service-actions";
import { MaintenanceFormFields, type PaymentMethodOption } from "@/components/vehicle/maintenance-form-fields";

const SERVICE_TYPES = [
  { value: "service", label: "Service" },
  { value: "repair", label: "Arreglo" },
];

export type AccountOption = PaymentMethodOption & { ownership: "own" | "associate" | "provider" };

/**
 * Ícono de "Service / arreglo" del header de una reserva: dos modos según el
 * estado actual (`mode`), ver `canMarkService`/`canCloseService` en
 * rental-flags.ts.
 *
 * - **open** (reserva `reserved`, sin entrega): registra el motivo y deja el
 *   auto y la reserva "en service" — sin costo todavía, se carga al cerrar.
 * - **close** (reserva `out_of_service`): el auto vuelve a estar disponible.
 *   El costo final, si lo hay, se paga en el momento o se carga como deuda a
 *   un proveedor/asociado (cuenta corriente de Caja).
 *
 * El envío se maneja a mano (en vez de `<form action>` nativo): así el modal
 * se queda abierto mientras la acción corre y sólo se cierra si termina bien.
 */
export function AddServiceButton({
  rentalId,
  vehicleId,
  currentKm,
  mode,
  paymentMethods,
  accounts,
}: {
  rentalId: string;
  vehicleId: string;
  currentKm: number | null;
  mode: "open" | "close";
  /** Solo para `mode="open"` (siempre "cuenta propia" hoy: sin costo acá). */
  paymentMethods?: PaymentMethodOption[];
  /** Solo para `mode="close"`: cuentas propias + proveedor/asociado. */
  accounts?: AccountOption[];
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pendingData, setPendingData] = useState<FormData | null>(null);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const router = useRouter();

  function openModal() {
    setError(undefined);
    setConfirming(false);
    setPendingData(null);
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setConfirming(false);
    setPendingData(null);
  }

  function submitAction(data: FormData) {
    start(async () => {
      try {
        if (mode === "open") await markVehicleService(rentalId, vehicleId, data);
        else await returnVehicleFromService(rentalId, vehicleId, data);
        closeModal();
        router.refresh();
      } catch (err) {
        // Las acciones redirigen al terminar bien: ese error interno de Next
        // tiene que propagarse, no mostrarse como un fallo real.
        unstable_rethrow(err);
        setConfirming(false);
        setError(err instanceof Error ? err.message : "No se pudo guardar el registro.");
      }
    });
  }

  // "open" pide confirmación explícita (dos pasos) porque bloquea el auto;
  // "close" es la vuelta a la normalidad, un solo paso alcanza.
  function handleOpenSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    setPendingData(new FormData(e.currentTarget));
    setConfirming(true);
  }
  function confirmOpenSubmit() {
    if (pendingData) submitAction(pendingData);
  }
  function handleCloseSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    submitAction(new FormData(e.currentTarget));
  }

  const title = mode === "open" ? "Marcar service / arreglo" : "Volver a poner en servicio";
  const iconLabel =
    mode === "open"
      ? "Marcar service / arreglo (deja el auto fuera de servicio)"
      : "Volver a poner en servicio";

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        title={iconLabel}
        aria-label={iconLabel}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
      >
        <ServiceIcon />
      </button>

      <Modal open={open} onClose={closeModal} title={title}>
        {mode === "open" ? (
          <form onSubmit={handleOpenSubmit} className="flex flex-col gap-3">
            {/* El <form> queda siempre montado (nunca se desmonta al pasar a
                "confirming"): así los campos no pierden lo tipeado si el
                empleado toca "Volver" para revisar algo antes de confirmar. */}
            <fieldset disabled={confirming} className="contents">
              <MaintenanceFormFields
                types={SERVICE_TYPES}
                currentKm={currentKm}
                paymentMethods={paymentMethods ?? []}
                showCost={false}
              />
            </fieldset>

            {confirming ? (
              <>
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400">
                  ¿Confirmás? El auto queda <strong>fuera de servicio</strong> hasta que lo marques
                  de vuelta en servicio desde esta misma reserva.
                </p>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" className="flex-1" onClick={() => setConfirming(false)} disabled={pending}>
                    Volver
                  </Button>
                  <Button type="button" className="flex-1" onClick={confirmOpenSubmit} disabled={pending}>
                    {pending ? "Guardando…" : "Sí, marcar fuera de servicio"}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Deja el auto <strong>fuera de servicio</strong>. El costo se carga después, al
                  volver a ponerlo en servicio.
                </p>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" className="flex-1" onClick={closeModal}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1">
                    Continuar
                  </Button>
                </div>
              </>
            )}
          </form>
        ) : (
          <CloseServiceForm
            currentKm={currentKm}
            accounts={accounts ?? []}
            error={error}
            pending={pending}
            onCancel={closeModal}
            onSubmit={handleCloseSubmit}
          />
        )}
      </Modal>
    </>
  );
}

function CloseServiceForm({
  currentKm,
  accounts,
  error,
  pending,
  onCancel,
  onSubmit,
}: {
  currentKm: number | null;
  accounts: AccountOption[];
  error: string | undefined;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  const [cost, setCost] = useState("");
  const [accountId, setAccountId] = useState("");
  const hasCost = cost.trim() !== "" && Number(cost) > 0;
  const selectedAccount = accounts.find((a) => a.id === accountId);
  const ownAccounts = accounts.filter((a) => a.ownership === "own");
  const otherAccounts = accounts.filter((a) => a.ownership !== "own");

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <p className="text-xs text-foreground/60">
        El auto vuelve a estar <strong>disponible</strong>. Si hubo un costo final, elegí de dónde
        sale — o cargalo como deuda a un proveedor/asociado si todavía no se pagó.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <TextField id="date" label="Fecha de vuelta" type="date" required defaultValue={formatDateInput(new Date())} />
        <TextField id="km" label="Km" type="number" inputMode="numeric" defaultValue={currentKm ?? ""} />
      </div>
      <TextField
        id="cost"
        label="Costo final"
        hint="Opcional"
        type="text"
        inputMode="decimal"
        prefix="$"
        value={cost}
        onChange={(e) => setCost(e.target.value)}
      />
      {hasCost && (
        <>
          <SelectField
            id="accountId"
            label="Cuenta"
            required
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            <option value="" disabled>
              Elegí una cuenta
            </option>
            {ownAccounts.length > 0 && (
              <optgroup label="Cuenta propia — pago ahora">
                {ownAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </optgroup>
            )}
            {otherAccounts.length > 0 && (
              <optgroup label="Proveedor / asociado — queda a deber">
                {otherAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </optgroup>
            )}
          </SelectField>
          {selectedAccount?.requiresNote && (
            <TextField id="accountNote" label="¿A dónde fue?" hint="Obligatorio para esta cuenta" required />
          )}
        </>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" variant="secondary" className="flex-1" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? "Guardando…" : "Volver a poner en servicio"}
        </Button>
      </div>
    </form>
  );
}
