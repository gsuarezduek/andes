"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { TextField, DateField } from "@/components/ui/fields";
import { CurrencyToggle } from "@/components/cash/currency-toggle";
import { createInvoice } from "@/app/(app)/caja/invoicing-actions";
import { parseDecimal } from "@/lib/number-input";
import { formatDateInput } from "@/lib/datetime";
import type { Currency } from "@/lib/currency";

/**
 * "+ Cargar factura": registro suelto (monto, fecha, razón social, CUIT), sin
 * vínculo formal con los ingresos pendientes de "Hay que facturar" — ver
 * comentario del modelo `Invoice` en el schema.
 */
export function InvoiceLauncher() {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("ars");
  const [date, setDate] = useState(() => formatDateInput(new Date()));
  const [razonSocial, setRazonSocial] = useState("");
  const [cuit, setCuit] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function openModal() {
    setAmount("");
    setCurrency("ars");
    setDate(formatDateInput(new Date()));
    setRazonSocial("");
    setCuit("");
    setError(undefined);
    setOpen(true);
  }

  const amountValue = parseDecimal(amount) ?? 0;
  const ready = amountValue > 0 && date.length > 0 && razonSocial.trim().length > 0 && cuit.trim().length > 0;

  function confirm() {
    setError(undefined);
    start(async () => {
      const res = await createInvoice({ amount: amountValue, currency, date, razonSocial: razonSocial.trim(), cuit: cuit.trim() });
      if (res.ok) setOpen(false);
      else setError(res.error);
    });
  }

  return (
    <>
      <Button type="button" variant="secondary" onClick={openModal}>
        + Cargar factura
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Cargar factura">
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-[7fr_3fr] gap-2">
            <TextField
              id="invoice_amount"
              label="Monto"
              type="text"
              inputMode="decimal"
              prefix={currency === "usd" ? "US$" : "$"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <CurrencyToggle value={currency} onChange={setCurrency} />
          </div>
          <DateField id="invoice_date" label="Fecha" value={date} onChange={setDate} />
          <TextField
            id="invoice_razon_social"
            label="Razón Social"
            value={razonSocial}
            onChange={(e) => setRazonSocial(e.target.value)}
          />
          <TextField
            id="invoice_cuit"
            label="CUIT"
            placeholder="20-12345678-9"
            value={cuit}
            onChange={(e) => setCuit(e.target.value)}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="mt-1 flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" className="flex-1" disabled={pending || !ready} onClick={confirm}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
