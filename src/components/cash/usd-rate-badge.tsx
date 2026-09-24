"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { TextField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatDateTime } from "@/lib/datetime";
import { formatMoney } from "@/lib/contract";
import { setUsdRate } from "@/app/(app)/caja/usd-rate-actions";

/**
 * Valor de referencia del USD, arriba a la derecha en Caja. Lo ven todos los
 * roles (sirve para estimar un movimiento en dólares); solo el admin lo
 * puede actualizar. Con `null` todavía no hay ninguno cargado.
 */
export function UsdRateBadge({
  current,
  canEdit,
}: {
  current: { rate: number; createdAt: Date; createdByName: string } | null;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);

  const content = (
    <>
      <span className="text-xs text-foreground/50">Valor de referencia USD</span>
      <span className="text-base font-semibold">{current ? formatMoney(current.rate, "ars") : "Sin cargar"}</span>
    </>
  );

  return (
    <>
      {canEdit ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex flex-col items-end rounded-lg border border-foreground/10 px-3 py-1.5 text-right hover:bg-foreground/5"
          aria-label="Editar valor de referencia del USD"
        >
          {content}
        </button>
      ) : (
        <div className="flex flex-col items-end rounded-lg border border-foreground/10 px-3 py-1.5 text-right">
          {content}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Valor de referencia del USD">
        <form
          action={async (formData) => {
            await setUsdRate(formData);
            setOpen(false);
          }}
          className="flex flex-col gap-3"
        >
          <p className="text-sm text-foreground/60">
            Pesos por 1 USD. Los movimientos en dólares se pasan a pesos en Reportes con el valor que regía cuando se
            cargaron; cambiarlo no modifica los anteriores.
          </p>
          <TextField
            id="rate"
            label="Pesos por 1 USD"
            type="number"
            step="0.01"
            min="0"
            prefix="$"
            defaultValue={current?.rate}
            required
          />
          {current && (
            <p className="text-xs text-foreground/50">
              Último cambio: {current.createdByName} · {formatDateTime(current.createdAt)}
            </p>
          )}
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-foreground/50">
              Cancelar
            </button>
            <SubmitButton pendingLabel="Guardando…" className="ml-auto">
              Guardar
            </SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  );
}
