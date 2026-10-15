"use client";

import { useState } from "react";
import type { PaymentMethodOwnership } from "@prisma/client";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { TextField, TextareaField, SelectField } from "@/components/ui/fields";
import { RentalPicker } from "@/components/cash/rental-picker";
import { CurrencyToggle } from "@/components/cash/currency-toggle";
import { PaymentMethodPicker } from "@/components/cash/payment-method-picker";
import { MovementDetailModal } from "@/components/cash/movement-row";
import { createCashMovement } from "@/app/(app)/caja/actions";
import type { CashMovementRow, RentalPickerOption, RoomBookingPickerOption } from "@/lib/cash";
import type { Currency } from "@/lib/currency";

type PaymentMethodOption = { id: string; name: string; requiresNote: boolean; ownership: PaymentMethodOwnership };
type ExpenseCategoryOption = { id: string; name: string };

/**
 * Formulario de alta de un ingreso o un egreso. `mode` lo fija el botón que
 * lo abrió (ver MovementLauncher) — este componente ya no maneja ese estado.
 *
 * En un Egreso hay dos cuentas: Origen (de dónde sale la plata, cualquier
 * cuenta, obligatorio) y Destino (a quién se le paga, solo cuentas ajenas,
 * opcional). En un Ingreso sigue siendo un único "Medio de pago" con todas
 * las cuentas, como antes.
 */
export function CashMovementForm({
  mode,
  onCancel,
  paymentMethods,
  rentalOptions,
  roomBookingOptions,
  expenseCategories,
}: {
  mode: "income" | "expense";
  onCancel: () => void;
  paymentMethods: PaymentMethodOption[];
  rentalOptions: RentalPickerOption[];
  roomBookingOptions: RoomBookingPickerOption[];
  expenseCategories: ExpenseCategoryOption[];
}) {
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [recipientPaymentMethodId, setRecipientPaymentMethodId] = useState("");
  const [currency, setCurrency] = useState<Currency>("ars");
  const [needsInvoice, setNeedsInvoice] = useState(false);
  const [error, setError] = useState<string>();
  const [created, setCreated] = useState<CashMovementRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const selectedMethod = paymentMethods.find((m) => m.id === paymentMethodId);
  const selectedRecipient = paymentMethods.find((m) => m.id === recipientPaymentMethodId);

  const thirdPartyMethods = paymentMethods.filter((m) => m.ownership !== "own");

  async function submit(formData: FormData) {
    setError(undefined);
    try {
      const row = await createCashMovement(mode, formData);
      setCreated(row);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el movimiento.");
    }
  }

  // Volver a un formulario en blanco para cargar otro del mismo tipo — se
  // resetean los campos sin estado (detalle, monto, etc.) solo porque esta
  // rama reemplaza por completo la del éxito, montando un `<form>` nuevo.
  function addAnother() {
    setCreated(null);
    setDetailOpen(false);
    setPaymentMethodId("");
    setRecipientPaymentMethodId("");
    setCurrency("ars");
    setNeedsInvoice(false);
    setError(undefined);
  }

  if (created) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-4">
        <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          {mode === "income" ? "Ingreso" : "Egreso"} agregado correctamente.
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={() => setDetailOpen(true)}>
            Ver {mode === "income" ? "ingreso" : "pago"}
          </Button>
          <Button type="button" className="flex-1" onClick={addAnother}>
            Agregar otro
          </Button>
        </div>
        <button type="button" onClick={onCancel} className="self-start text-xs text-foreground/50">
          Cerrar
        </button>
        <MovementDetailModal
          movement={created}
          tone={mode === "income" ? "emerald" : "red"}
          paymentMethods={paymentMethods}
          expenseCategories={expenseCategories}
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
        />
      </div>
    );
  }

  return (
    <form action={submit} className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{mode === "income" ? "Nuevo ingreso" : "Nuevo egreso"}</h2>
        <button type="button" onClick={onCancel} className="text-xs text-foreground/50">
          Cancelar
        </button>
      </div>
      <TextareaField
        id="description"
        label="Detalle"
        required
        rows={2}
        placeholder="Ej: seña reserva Juan Pérez"
      />
      <div className="grid grid-cols-[7fr_3fr] gap-2">
        <TextField id="amount" label="Monto" type="number" step="0.01" min="0" prefix="$" required />
        <CurrencyToggle value={currency} onChange={setCurrency} />
      </div>
      <PaymentMethodPicker
        id="paymentMethodId"
        label={mode === "expense" ? "Origen" : "Medio de pago"}
        options={paymentMethods}
        value={paymentMethodId}
        onChange={setPaymentMethodId}
        placeholder={mode === "expense" ? "Elegí de dónde sale la plata" : "Buscar medio de pago…"}
      />
      {selectedMethod?.requiresNote && (
        <TextField
          id="paymentMethodNote"
          label="¿A dónde fue?"
          hint="Obligatorio para este medio de pago"
          required
        />
      )}
      {mode === "expense" && (
        <>
          <PaymentMethodPicker
            id="recipientPaymentMethodId"
            label="Destino"
            hint="Opcional — cuenta ajena a la que se le pagó"
            options={thirdPartyMethods}
            value={recipientPaymentMethodId}
            onChange={setRecipientPaymentMethodId}
            placeholder="Sin destino específico — buscar…"
          />
          {selectedRecipient?.requiresNote && (
            <TextField
              id="recipientPaymentMethodNote"
              label="¿A dónde fue? (destino)"
              hint="Obligatorio para este destino"
              required
            />
          )}
          {expenseCategories.length > 0 && (
            <SelectField id="categoryId" label="Categoría" hint="Opcional" defaultValue="">
              <option value="">Sin categoría</option>
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectField>
          )}
        </>
      )}
      {mode === "income" && (
        <>
          <RentalPicker options={rentalOptions} roomBookingOptions={roomBookingOptions} />
          <label className="flex items-start gap-2 text-sm text-foreground/70">
            <input type="checkbox" name="isGuarantee" className="mt-0.5 h-4 w-4 rounded border-foreground/30" />
            <span>
              Es una garantía
              <span className="block text-xs text-foreground/50">
                Se toma para devolver (o cobrar) después — no es un cobro real del negocio todavía. Se registra
                aparte, en la pestaña Garantías, con sus propios botones de Devolver/Cobrar.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-foreground/70">
            <input
              type="checkbox"
              name="needsInvoice"
              checked={needsInvoice}
              onChange={(e) => setNeedsInvoice(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-foreground/30"
            />
            <span>
              Hay que facturar
              <span className="block text-xs text-foreground/50">
                Queda pendiente en Caja → Facturación hasta que se cargue la factura correspondiente.
              </span>
            </span>
          </label>
          {needsInvoice && (
            <div className="grid grid-cols-1 gap-2 pl-6 sm:grid-cols-2">
              <TextField id="invoicingName" label="Nombre y Apellido o Razón Social" required />
              <TextField id="invoicingCuit" label="CUIT" placeholder="20-12345678-9" required />
            </div>
          )}
        </>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <SubmitButton pendingLabel="Guardando…" disabled={!paymentMethodId}>
        {mode === "income" ? "Agregar ingreso" : "Agregar egreso"}
      </SubmitButton>
    </form>
  );
}
