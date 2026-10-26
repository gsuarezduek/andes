import type { Metadata } from "next";
import { requireUser } from "@/lib/auth-helpers";
import { hasAdminAccess } from "@/lib/user-permissions";
import { FleetTabs } from "@/components/rooms/fleet-tabs";
import { PermitForm } from "@/components/permits/permit-form";
import { PermitRow } from "@/components/permits/permit-row";
import { getPermits, getPermitEdits } from "@/lib/permits";
import { getRentalPickerOptions } from "@/lib/cash";
import { formatDateTime } from "@/lib/datetime";

export const metadata: Metadata = { title: "Permisos — Andes" };

const ARCA_CLAIM_EMAIL = "DRIOSROSANAS@ARCA.GOB.AR";

export default async function PermitsPage() {
  const user = await requireUser();
  const isAdmin = hasAdminAccess(user.role);

  const [permits, rentalOptions, edits] = await Promise.all([
    getPermits(),
    getRentalPickerOptions(),
    isAdmin ? getPermitEdits() : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <FleetTabs active="permits" />

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Permisos</h1>
        <p className="text-sm text-foreground/60">
          {permits.length} permiso{permits.length === 1 ? "" : "s"} cargado{permits.length === 1 ? "" : "s"}.
        </p>
      </div>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
        <span className="font-medium">Email para reclamo ARCA:</span>{" "}
        <a href={`mailto:${ARCA_CLAIM_EMAIL}`} className="underline">
          {ARCA_CLAIM_EMAIL}
        </a>
      </div>

      <PermitForm rentalOptions={rentalOptions} />

      {permits.length === 0 ? (
        <p className="rounded-lg border border-foreground/10 px-4 py-3 text-sm text-foreground/50">
          Todavía no hay permisos cargados.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {permits.map((p) => (
            <PermitRow key={p.id} permit={p} isAdmin={isAdmin} />
          ))}
        </ul>
      )}

      {isAdmin && edits.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground/50">Historial de ediciones</h2>
          <ul className="flex flex-col gap-2">
            {edits.map((e) => (
              <li key={e.id} className="rounded-lg border border-foreground/10 px-3 py-2 text-sm">
                <p className={e.action === "deleted" ? "text-red-600" : ""}>
                  {e.action === "deleted"
                    ? `Eliminado — Permiso N° ${e.permitNumber}`
                    : `Permiso N° ${e.permitNumber} — ${(e.changes ?? []).map((c) => `${c.field}: ${c.from} → ${c.to}`).join(" · ")}`}
                </p>
                <p className="mt-1 text-xs text-foreground/50">
                  {e.editedByName} · {formatDateTime(e.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
