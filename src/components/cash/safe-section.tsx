import { SectionTitle } from "@/components/ui/section-title";
import { formatArs } from "@/lib/contract";
import { formatDateTime } from "@/lib/datetime";
import { SafeMovementRow } from "./safe-movement-row";
import type { SafeMovementEditRow, SafeMovementRow as SafeMovementRowData } from "@/lib/safe";

/**
 * Historial de caja fuerte. `balance` es `null` para no-admin: el saldo
 * acumulado es info sensible y no se manda ni se muestra; el historial
 * (fecha + quién) sí es visible para cualquier rol, pero cada uno solo ve
 * sus propios movimientos (`movements` ya viene filtrado desde la página).
 * Editar/borrar (`SafeMovementRow`) solo aparece cuando hay `balance`
 * (admin) — mismo criterio que Ingresos/Egresos.
 */
export function SafeSection({
  movements,
  balance,
  edits,
}: {
  movements: SafeMovementRowData[];
  balance: number | null;
  edits?: SafeMovementEditRow[];
}) {
  const isAdmin = balance !== null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle>Caja fuerte</SectionTitle>
        {balance !== null && (
          <span className="text-sm font-semibold">
            Saldo: <span className={balance < 0 ? "text-red-600" : ""}>{formatArs(balance)}</span>
          </span>
        )}
      </div>
      <p className="-mt-2 text-xs text-foreground/50">
        Efectivo físico guardado — no se relaciona con los ingresos/egresos de reservas de arriba.
      </p>

      {movements.length === 0 ? (
        <p className="rounded-lg border border-foreground/10 px-3 py-2 text-sm text-foreground/50">
          Sin movimientos.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {movements.map((m) =>
            isAdmin ? (
              <SafeMovementRow key={`${m.id}:${m.description}:${m.amount}`} movement={m} />
            ) : (
              <li key={m.id} className="rounded-lg border border-foreground/10 px-3 py-2 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 whitespace-pre-wrap">{m.description}</p>
                  <p
                    className={`shrink-0 font-semibold ${m.type === "deposit" ? "text-emerald-600" : "text-red-600"}`}
                  >
                    {m.type === "deposit" ? "+" : "-"}
                    {formatArs(m.amount)}
                  </p>
                </div>
                <p className="mt-1 text-xs text-foreground/50">
                  {m.type === "deposit" ? "Ingreso" : "Retiro"} · {formatDateTime(m.createdAt)}
                </p>
              </li>
            ),
          )}
        </ul>
      )}

      {isAdmin && edits && edits.length > 0 && (
        <div className="mt-2 flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
            Historial de ediciones (caja fuerte)
          </h3>
          <ul className="flex flex-col gap-2">
            {edits.map((e) => (
              <li key={e.id} className="rounded-lg border border-foreground/10 px-3 py-2 text-sm">
                <p className={e.action === "deleted" ? "text-red-600" : ""}>
                  {e.action === "deleted"
                    ? `Eliminado — ${e.movementDescription} (${formatArs(e.movementAmount)})`
                    : (e.changes ?? []).map((c) => `${c.field}: ${c.from} → ${c.to}`).join(" · ")}
                </p>
                <p className="mt-1 text-xs text-foreground/50">
                  {e.editedByName} · {formatDateTime(e.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
