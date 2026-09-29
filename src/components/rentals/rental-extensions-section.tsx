import { formatArs } from "@/lib/contract";
import { formatDateTime } from "@/lib/datetime";

export type RentalExtensionRow = {
  id: string;
  newEndAt: Date;
  extraDays: number;
  amount: number;
  note: string | null;
  createdByName: string;
  createdAt: Date;
};

/**
 * Historial de extensiones confirmadas (ver `extendRental`): reemplaza a la
 * nota de texto libre que se solía cargar a mano — cada extensión queda acá
 * con quién la autorizó, cuántos días y cuánto se sumó al contrato. No se
 * renderiza si nunca hubo ninguna.
 */
export function RentalExtensionsSection({ extensions }: { extensions: RentalExtensionRow[] }) {
  if (extensions.length === 0) return null;

  return (
    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4">
      <p className="text-xs font-medium text-foreground/70">Extensiones</p>
      <ul className="mt-2 flex flex-col gap-2">
        {extensions.map((e) => (
          <li key={e.id} className="rounded-lg bg-foreground/[0.04] px-3 py-2 text-sm">
            <p className="font-medium">
              +{e.extraDays} día{e.extraDays === 1 ? "" : "s"} → nueva devolución {formatDateTime(e.newEndAt)}
              {" · "}
              {formatArs(e.amount)}
            </p>
            <p className="text-xs text-foreground/50">
              {e.createdByName} · {formatDateTime(e.createdAt)}
            </p>
            {e.note && <p className="text-xs text-foreground/70">{e.note}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
