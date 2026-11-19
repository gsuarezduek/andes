"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { TextareaField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatDateTime } from "@/lib/datetime";
import { useCashViewer } from "@/components/cash/cash-viewer-context";
import {
  approveChangeRequest,
  rejectChangeRequest,
  withdrawChangeRequest,
} from "@/app/(app)/caja/change-request-actions";
import type { CashChangeRequestView } from "@/lib/cash";

/**
 * Un pedido de cambio de un empleado sobre un movimiento de Caja (ver
 * `CashMovementChangeRequest`). Pendiente: qué se pide cambiar y, según quién
 * mira, Aprobar/Rechazar (admin/finanzas) o Retirar pedido (quien lo pidió).
 * Rechazado: el motivo. Aprobado o cancelado: un renglón de estado (solo se
 * llega a ver en la lista "Tus pedidos").
 */
export function ChangeRequestBox({ request }: { request: CashChangeRequestView }) {
  const { canApprove, userId } = useCashViewer();
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isDelete = request.kind === "delete";
  const pending = request.status === "pending";
  const isOwn = userId != null && request.requestedById === userId;

  function run(fn: () => Promise<{ error?: string; notice?: string }>) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const r = await fn();
      if (r.error) setError(r.error);
      else if (r.notice) setNotice(r.notice);
    });
  }

  const tone = pending
    ? "border-amber-500/40 bg-amber-500/10"
    : request.status === "rejected"
      ? "border-red-500/30 bg-red-500/5"
      : "border-foreground/10 bg-foreground/[0.03]";

  const title = pending
    ? isDelete
      ? "Eliminación pendiente de aprobación"
      : "Cambio pendiente de aprobación"
    : request.status === "rejected"
      ? isDelete
        ? "Pedido de eliminación rechazado"
        : "Pedido de cambio rechazado"
      : request.status === "approved"
        ? isDelete
          ? "Eliminación aprobada"
          : "Cambio aprobado"
        : "Pedido cancelado";

  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${tone}`}>
      <p className="font-medium">{title}</p>
      <p className="text-xs text-foreground/60">
        Pedido por {isOwn ? "vos" : request.requestedByName} · {formatDateTime(request.createdAt)}
      </p>

      {request.changes.length > 0 && (
        <ul className="mt-1.5 flex flex-col gap-0.5 text-xs">
          {request.changes.map((c, i) => (
            <li key={i}>
              <span className="text-foreground/60">{c.field}:</span> <span className="line-through">{c.from}</span>{" "}
              → <span className="font-medium">{c.to}</span>
            </li>
          ))}
        </ul>
      )}
      {request.note && (
        <p className="mt-1.5 text-xs">
          <span className="text-foreground/60">Motivo:</span> {request.note}
        </p>
      )}

      {!pending && request.resolvedAt && (
        <p className="mt-1.5 text-xs text-foreground/70">
          {request.status === "rejected" ? "Rechazado" : request.status === "approved" ? "Aprobado" : "Cancelado"} por{" "}
          {request.resolvedByName ?? "—"} · {formatDateTime(request.resolvedAt)}
          {request.resolutionNote ? ` — ${request.resolutionNote}` : ""}
        </p>
      )}

      {pending && canApprove && !rejecting && (
        <div className="mt-2 flex gap-2">
          <Button
            type="button"
            variant={isDelete ? "danger" : "primary"}
            className="h-auto flex-1 py-1.5 text-xs"
            disabled={isPending}
            onClick={() => run(() => approveChangeRequest(request.id))}
          >
            {isPending ? "Aplicando…" : isDelete ? "Aprobar y eliminar" : "Aprobar cambio"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="h-auto flex-1 py-1.5 text-xs"
            disabled={isPending}
            onClick={() => setRejecting(true)}
          >
            Rechazar
          </Button>
        </div>
      )}

      {pending && canApprove && rejecting && (
        <form
          action={async (fd) => {
            const r = await rejectChangeRequest(request.id, fd);
            if (r.error) setError(r.error);
            else setRejecting(false);
          }}
          className="mt-2 flex flex-col gap-2"
        >
          <TextareaField id="reason" label="Motivo del rechazo" hint="Lo ve quien hizo el pedido" required rows={2} />
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setRejecting(false)} className="text-xs text-foreground/50">
              Volver
            </button>
            <SubmitButton pendingLabel="Rechazando…" variant="danger" className="ml-auto h-auto px-2.5 py-1 text-xs">
              Rechazar pedido
            </SubmitButton>
          </div>
        </form>
      )}

      {pending && !canApprove && (
        <>
          <p className="mt-1.5 text-xs text-foreground/60">
            El movimiento no cambia hasta que lo apruebe un administrador o Finanzas.
          </p>
          {isOwn && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(() => withdrawChangeRequest(request.id))}
              className="mt-1 text-xs text-foreground/60 underline hover:text-foreground"
            >
              {isPending ? "Retirando…" : "Retirar pedido"}
            </button>
          )}
        </>
      )}

      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
      {notice && <p className="mt-1.5 text-xs text-emerald-700 dark:text-emerald-400">{notice}</p>}
    </div>
  );
}
