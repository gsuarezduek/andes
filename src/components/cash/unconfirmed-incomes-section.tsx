"use client";

import { useState } from "react";
import Link from "next/link";
import type { PaymentMethodOwnership } from "@prisma/client";
import { SectionTitle } from "@/components/ui/section-title";
import { formatMoney } from "@/lib/contract";
import { formatDateTime } from "@/lib/datetime";
import { ConfirmPaymentMethodForm } from "@/components/cash/confirm-payment-method-form";
import type { CashMovementRow } from "@/lib/cash";

type PaymentMethodOption = { id: string; name: string; requiresNote?: boolean; ownership: PaymentMethodOwnership };

function ConfirmRow({ movement, paymentMethods }: { movement: CashMovementRow; paymentMethods: PaymentMethodOption[] }) {
  const [open, setOpen] = useState(false);

  return (
    <li className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 whitespace-pre-wrap">{movement.description}</p>
        <p className="shrink-0 font-semibold text-emerald-600">{formatMoney(movement.amount, movement.currency)}</p>
      </div>
      <p className="mt-1 text-xs text-foreground/50">
        {movement.paymentMethodName}
        {movement.rentalClientName ? ` · ${movement.rentalClientName}` : ""} · {formatDateTime(movement.createdAt)}
      </p>
      {open ? (
        <ConfirmPaymentMethodForm
          movementId={movement.id}
          paymentMethods={paymentMethods}
          onCancel={() => setOpen(false)}
          extraFooter={
            movement.rentalId ? (
              <Link href={`/rentals/${movement.rentalId}`} className="text-xs text-foreground/50 underline">
                Ver reserva
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-xs font-medium text-amber-700 underline dark:text-amber-400"
          >
            Confirmar medio de pago
          </button>
          {movement.rentalId && (
            <Link href={`/rentals/${movement.rentalId}`} className="text-xs text-foreground/50 underline">
              Ver reserva
            </Link>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * Ingresos importados automáticamente desde VikRentCar (señas) cuyo medio de
 * pago real no se pudo resolver. Visible para cualquier rol — completar el
 * medio de pago no es "corregir un error de carga" (eso sigue siendo edición
 * completa, solo admin). Independiente del período elegido en Caja: mientras
 * quede pendiente, se muestra siempre arriba de todo.
 */
export function UnconfirmedIncomesSection({
  movements,
  paymentMethods,
}: {
  movements: CashMovementRow[];
  paymentMethods: PaymentMethodOption[];
}) {
  if (movements.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>
        Señas sin confirmar medio de pago ({movements.length})
      </SectionTitle>
      <p className="text-xs text-foreground/50">
        Vinieron de una reserva sincronizada con VikRentCar con algo ya pagado, pero no se pudo
        determinar a qué medio de pago de Andes corresponde. Ya están contadas en los totales de
        Caja como ingreso — solo falta indicar el medio real.
      </p>
      <ul className="flex flex-col gap-2">
        {movements.map((m) => (
          <ConfirmRow key={m.id} movement={m} paymentMethods={paymentMethods} />
        ))}
      </ul>
    </section>
  );
}
