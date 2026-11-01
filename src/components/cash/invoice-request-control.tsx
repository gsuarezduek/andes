"use client";

import { useState, useTransition } from "react";
import { TextField } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import { requestCashMovementInvoice, removeCashMovementInvoice } from "@/app/(app)/caja/invoicing-actions";

/**
 * Mandar un ingreso a Caja → Facturación a mano (ej. una reserva ya
 * entregada), corregir los datos del cliente de uno pendiente, o sacarlo si
 * se mandó por error. Compartido por el modal de Movimientos, la pestaña
 * Pagos de la reserva y la propia lista de Facturación. Un ingreso ya
 * facturado no muestra nada (no se toca más).
 */
export function InvoiceRequestControl({
  movementId,
  needsInvoice,
  invoiced,
  invoicingName,
  invoicingCuit,
  accountAutoInvoice,
}: {
  movementId: string;
  needsInvoice: boolean;
  invoiced: boolean;
  invoicingName: string | null;
  invoicingCuit: string | null;
  accountAutoInvoice: boolean;
}) {
  const [mode, setMode] = useState<"idle" | "form" | "confirmRemove">("idle");
  const [name, setName] = useState(invoicingName ?? "");
  const [cuit, setCuit] = useState(invoicingCuit ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (invoiced) return null;

  function close() {
    setMode("idle");
    setError(null);
    setName(invoicingName ?? "");
    setCuit(invoicingCuit ?? "");
  }

  function save() {
    setError(null);
    start(async () => {
      const res = await requestCashMovementInvoice(movementId, { invoicingName: name, invoicingCuit: cuit });
      if (res.ok) setMode("idle");
      else setError(res.error);
    });
  }

  function remove() {
    setError(null);
    start(async () => {
      const res = await removeCashMovementInvoice(movementId);
      if (res.ok) setMode("idle");
      else setError(res.error);
    });
  }

  if (mode === "form") {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-foreground/10 p-3">
        <p className="text-xs text-foreground/60">
          Si el cliente pidió factura a su nombre, cargá sus datos. Si no, dejalo vacío.
        </p>
        <TextField
          id={`inv_name_${movementId}`}
          label="Nombre y Apellido o Razón Social"
          hint="Opcional"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextField
          id={`inv_cuit_${movementId}`}
          label="CUIT"
          hint="Opcional"
          placeholder="20-12345678-9"
          value={cuit}
          onChange={(e) => setCuit(e.target.value)}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex items-center gap-3">
          <button type="button" onClick={close} className="text-xs text-foreground/50">
            Cancelar
          </button>
          <Button type="button" disabled={pending} className="ml-auto" onClick={save}>
            {pending ? "Guardando…" : needsInvoice ? "Guardar datos" : "Mandar a facturación"}
          </Button>
        </div>
      </div>
    );
  }

  if (mode === "confirmRemove") {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-red-500/30 p-3">
        <p className="text-xs text-red-600">¿Quitar este ingreso de Facturación? Ya no va a figurar como pendiente.</p>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex items-center gap-3">
          <button type="button" onClick={close} className="text-xs text-foreground/50">
            Cancelar
          </button>
          <Button type="button" variant="danger" disabled={pending} className="ml-auto" onClick={remove}>
            Sí, quitar
          </Button>
        </div>
      </div>
    );
  }

  if (!needsInvoice) {
    return (
      <Button type="button" variant="secondary" className="w-full" onClick={() => setMode("form")}>
        Mandar a facturación
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <button
        type="button"
        onClick={() => setMode("form")}
        className="text-xs text-foreground/50 underline hover:text-foreground/70"
      >
        {invoicingName || invoicingCuit ? "Editar datos de la factura" : "Agregar datos del cliente"}
      </button>
      {!accountAutoInvoice && (
        <button
          type="button"
          onClick={() => setMode("confirmRemove")}
          className="text-xs text-foreground/40 underline hover:text-foreground/60"
        >
          Quitar de facturación
        </button>
      )}
    </div>
  );
}
