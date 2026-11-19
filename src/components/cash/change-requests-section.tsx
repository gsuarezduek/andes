import { SectionTitle } from "@/components/ui/section-title";
import { ChangeRequestBox } from "@/components/cash/change-request-box";
import { formatMoney } from "@/lib/contract";
import { formatDateTime } from "@/lib/datetime";
import type { CashChangeRequestItem } from "@/lib/cash";

/**
 * Pedidos de cambio de empleados sobre ingresos/egresos (ver
 * `CashMovementChangeRequest`), arriba de Movimientos. Quien aprueba ve
 * "Cambios a aprobar" (todos los pendientes); un empleado ve "Tus pedidos"
 * (pendientes y resueltos en los últimos 14 días). Sin pedidos, no se muestra.
 */
export function ChangeRequestsSection({
  items,
  mode,
}: {
  items: CashChangeRequestItem[];
  mode: "approve" | "own";
}) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>
        {mode === "approve" ? `Cambios a aprobar (${items.length})` : "Tus pedidos de cambio"}
      </SectionTitle>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={`${item.id}:${item.status}`} className="flex flex-col gap-2 rounded-lg border border-foreground/10 p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate">
                  <span className="text-foreground/50">{item.movement.type === "income" ? "Ingreso" : "Egreso"} · </span>
                  {item.movement.description}
                </p>
                <p className="mt-0.5 truncate text-xs text-foreground/50">
                  {item.movement.paymentMethodName} · {formatDateTime(item.movement.createdAt)}
                  {item.movement.deleted && " · eliminado"}
                </p>
              </div>
              <span
                className={`shrink-0 font-semibold ${item.movement.type === "income" ? "text-emerald-600" : "text-red-600"}`}
              >
                {formatMoney(item.movement.amount, item.movement.currency)}
              </span>
            </div>
            <ChangeRequestBox request={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}
