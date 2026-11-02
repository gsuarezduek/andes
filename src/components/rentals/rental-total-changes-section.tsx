import { formatArs } from "@/lib/contract";
import { formatDateTime } from "@/lib/datetime";
import { formatSignedAmount } from "@/lib/rental-total-change";

export type RentalTotalChangeRow = {
  id: string;
  previousTotal: number;
  newTotal: number;
  appliedAmount: number | null;
  resolvedByName: string | null;
  resolvedAt: Date | null;
};

/**
 * Historial de avisos de cambio de total ya resueltos (ver `RentalTotalChange`):
 * explica por qué se movió el total del contrato, o por qué no se movió. No se
 * renderiza si nunca hubo ninguno.
 */
export function RentalTotalChangesSection({ changes }: { changes: RentalTotalChangeRow[] }) {
  if (changes.length === 0) return null;

  return (
    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4">
      <p className="text-xs font-medium text-foreground/70">Cambios de total en VikRentCar</p>
      <ul className="mt-2 flex flex-col gap-2">
        {changes.map((c) => (
          <li key={c.id} className="rounded-lg bg-foreground/[0.04] px-3 py-2 text-sm">
            <p className="font-medium">
              {formatArs(c.previousTotal)} → {formatArs(c.newTotal)}
              {" · "}
              {c.appliedAmount != null ? `${formatSignedAmount(c.appliedAmount, formatArs)} al contrato` : "Ignorado"}
            </p>
            <p className="text-xs text-foreground/50">
              {c.resolvedByName ?? "—"}
              {c.resolvedAt ? ` · ${formatDateTime(c.resolvedAt)}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
