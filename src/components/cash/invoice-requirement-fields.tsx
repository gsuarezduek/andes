"use client";

import { TextField } from "@/components/ui/fields";

/**
 * Checkbox "Hay que facturar" + los dos datos que pide (Nombre/Razón Social
 * y CUIT), compartido por "Agregar pago" (detalle de la reserva) y el paso
 * de pagos del wizard de entrega/devolución — mismo criterio visual que "Es
 * una garantía", que vive al lado. Ver `RentalPayment.needsInvoice` en
 * contract.ts: se propaga tal cual al CashMovement que genera el pago; el
 * ingreso queda pendiente en Caja → Facturación hasta que alguien lo marque
 * facturado.
 */
export function InvoiceRequirementFields({
  idPrefix,
  checked,
  onCheckedChange,
  name,
  onNameChange,
  cuit,
  onCuitChange,
}: {
  idPrefix: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  name: string;
  onNameChange: (v: string) => void;
  cuit: string;
  onCuitChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-start gap-2 text-sm text-foreground/70">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-foreground/30"
        />
        <span>
          Hay que facturar
          <span className="block text-xs text-foreground/50">
            Queda pendiente en Caja → Facturación hasta que se cargue la factura correspondiente.
          </span>
        </span>
      </label>
      {checked && (
        <div className="grid grid-cols-1 gap-2 pl-6 sm:grid-cols-2">
          <TextField
            id={`${idPrefix}_invoicingName`}
            label="Nombre y Apellido o Razón Social"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
          />
          <TextField
            id={`${idPrefix}_invoicingCuit`}
            label="CUIT"
            placeholder="20-12345678-9"
            value={cuit}
            onChange={(e) => onCuitChange(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

/** ¿Están completos los datos de facturación, si se marcó el checkbox? */
export function isInvoiceRequirementReady(checked: boolean, name: string, cuit: string): boolean {
  return !checked || (name.trim().length > 0 && cuit.trim().length > 0);
}
