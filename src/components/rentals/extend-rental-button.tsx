"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TextField, TextareaField } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ExtendIcon } from "@/components/ui/icons";
import { formatArs } from "@/lib/contract";
import { formatDateTimeInput, mendozaWallTimeToUtc } from "@/lib/datetime";
import { extensionExtraDays, suggestedExtensionAmount } from "@/lib/rental-extension";
import { extendRental } from "@/app/(app)/rentals/[id]/extension-actions";
import { resendActaEmail } from "@/app/(app)/rentals/[id]/acta-actions";

/**
 * Botón-ícono en el header de la reserva para registrar que el cliente
 * extendió el alquiler (típico al momento de devolver). A diferencia de
 * "Editar devolución" (sin cargo), esto suma el importe al contrato — el
 * saldo/semáforo de pago dejan de mostrar "pagado" apenas se confirma, sin
 * depender de una nota.
 *
 * El acta de entrega toma la fecha de devolución en vivo de `rental.endAt`
 * (ver `renderActaBuffer`), así que no hace falta "rehacerla": alcanza con
 * reenviarla. Tras confirmar la extensión, se ofrece hacerlo de una —
 * necesita `handoverInspectionId` (la entrega ya firmada de esta reserva).
 */
export function ExtendRentalButton({
  rentalId,
  currentEndAt,
  dailyRate,
  handoverInspectionId,
}: {
  rentalId: string;
  currentEndAt: Date;
  dailyRate: number | null;
  handoverInspectionId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [newEndAt, setNewEndAt] = useState("");
  const [amount, setAmount] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [resendPending, startResend] = useTransition();
  const [resendResult, setResendResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const router = useRouter();

  const extraDays = useMemo(() => {
    if (!newEndAt) return 0;
    try {
      return extensionExtraDays(currentEndAt, mendozaWallTimeToUtc(newEndAt));
    } catch {
      return 0;
    }
  }, [newEndAt, currentEndAt]);

  const suggested = suggestedExtensionAmount(dailyRate, extraDays);
  const amountValue = amountTouched ? amount : (suggested != null ? String(suggested) : "");
  const parsedAmount = Number(amountValue.replace(",", "."));
  const amountValid = amountValue.trim() !== "" && Number.isFinite(parsedAmount) && parsedAmount >= 0;

  function openModal() {
    setNewEndAt(formatDateTimeInput(currentEndAt));
    setAmount("");
    setAmountTouched(false);
    setNote("");
    setError(undefined);
    setDone(false);
    setResendResult(null);
    setOpen(true);
  }

  function confirm() {
    if (!newEndAt || !amountValid || extraDays <= 0) return;
    setError(undefined);
    start(async () => {
      const res = await extendRental(rentalId, { newEndAt, amount: parsedAmount, note: note.trim() || undefined });
      if (res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
      setDone(true);
    });
  }

  function resendActa() {
    if (!handoverInspectionId) return;
    startResend(async () => {
      setResendResult(null);
      const r = await resendActaEmail(rentalId, handoverInspectionId);
      setResendResult(r);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        title="Extender alquiler"
        aria-label="Extender alquiler"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
      >
        <ExtendIcon />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Extender alquiler">
        {done ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-emerald-600">
              Extensión confirmada — la nueva fecha de devolución ya figura en la reserva.
            </p>
            {handoverInspectionId ? (
              <>
                <p className="text-sm text-foreground/70">
                  El acta de entrega muestra la fecha de devolución en vivo: ¿querés reenviársela
                  al cliente ya actualizada?
                </p>
                {resendResult && !resendPending && (
                  <p className={`text-sm ${resendResult.ok ? "text-emerald-600" : "text-red-600"}`}>
                    {resendResult.ok ? "Acta reenviada." : (resendResult.error ?? "No se pudo reenviar.")}
                  </p>
                )}
                <div className="mt-1 flex gap-2">
                  <Button type="button" variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
                    Cerrar
                  </Button>
                  <Button
                    type="button"
                    className="flex-1"
                    disabled={resendPending || resendResult?.ok}
                    onClick={resendActa}
                  >
                    {resendPending ? "Reenviando…" : resendResult?.ok ? "Reenviada ✓" : "Reenviar acta al cliente"}
                  </Button>
                </div>
              </>
            ) : (
              <Button type="button" className="w-full" onClick={() => setOpen(false)}>
                Cerrar
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <TextField
              id="extend_new_end_at"
              label="Nueva fecha y hora de devolución"
              type="datetime-local"
              value={newEndAt}
              onChange={(e) => setNewEndAt(e.target.value)}
            />
            {newEndAt && extraDays <= 0 && (
              <p className="text-xs font-medium text-red-600">Tiene que ser posterior a la fecha actual de devolución.</p>
            )}
            {extraDays > 0 && (
              <p className="text-xs text-foreground/60">
                {extraDays} día{extraDays === 1 ? "" : "s"} extra
                {suggested != null ? ` · sugerido ${formatArs(suggested)} (tarifa diaria × días)` : ""}
              </p>
            )}
            <TextField
              id="extend_amount"
              label="Cargo por la extensión"
              type="text"
              inputMode="decimal"
              prefix="$"
              value={amountValue}
              onChange={(e) => {
                setAmountTouched(true);
                setAmount(e.target.value);
              }}
              hint={dailyRate == null ? "No hay tarifa diaria cargada — completalo a mano." : undefined}
            />
            <TextareaField
              id="extend_note"
              label="Motivo / quién autorizó"
              hint="Opcional"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="mt-1 flex gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" className="flex-1" disabled={pending || extraDays <= 0 || !amountValid} onClick={confirm}>
                {pending ? "Guardando…" : "Confirmar extensión"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
