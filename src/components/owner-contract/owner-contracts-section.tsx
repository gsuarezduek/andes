import type { OwnerContract } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/section-title";
import { formatDateTime } from "@/lib/datetime";
import { OWNER_CONTRACT_STATUS, ownerContractStatus } from "@/lib/owner-contract";
import { OwnerContractActions } from "./owner-contract-actions";

const EMAIL_LABEL: Record<string, string> = {
  sent: "PDF enviado al propietario",
  failed: "No se pudo enviar el PDF",
  skipped: "PDF sin enviar",
};

/** Contratos de cesión del auto (el más nuevo primero), con su PDF. Ya firmados: no se editan. */
export function OwnerContractsSection({
  vehicleId,
  isAdmin,
  contracts,
  now,
}: {
  vehicleId: string;
  isAdmin: boolean;
  contracts: OwnerContract[];
  now: Date;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <SectionTitle>Contrato con el titular</SectionTitle>
        <p className="text-sm text-foreground/60">
          Contrato entre MDZ Rent a Car y el dueño del auto. Es aparte del contrato que firma cada cliente cuando alquila, que
          sigue igual que en cualquier otro auto.
        </p>
        <ButtonLink href={`/vehicles/${vehicleId}/owner-contract/new`} className="self-start">
          {contracts.length > 0 ? "Nuevo contrato o renovación" : "Crear contrato"}
        </ButtonLink>
      </div>

      {contracts.length === 0 ? (
        <p className="rounded-lg border border-foreground/10 p-6 text-center text-sm text-foreground/60">
          Todavía no se firmó ningún contrato con el titular.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {contracts.map((c) => {
            const status = OWNER_CONTRACT_STATUS[ownerContractStatus(c, now)];
            return (
              <li key={c.id} className="flex flex-col gap-2 rounded-xl border border-foreground/10 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">Contrato N.º {c.number} · {c.ownerName}</p>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </div>
                <p className="text-sm text-foreground/70">
                  {formatDateTime(c.startsAt)} → {formatDateTime(c.endsAt)}
                </p>
                <p className="text-xs text-foreground/50">
                  Firmado el {formatDateTime(c.createdAt)} · Por MDZ: {c.companySignerName} · Cargado por {c.createdByName}
                </p>
                {c.commercialTerms && <p className="whitespace-pre-line text-sm text-foreground/70">{c.commercialTerms}</p>}
                {c.voidedAt && (
                  <p className="text-xs text-red-700 dark:text-red-400">
                    Dado de baja el {formatDateTime(c.voidedAt)} por {c.voidedByName}: {c.voidedReason}
                  </p>
                )}
                {c.emailStatus && (
                  <p className={`text-xs ${c.emailStatus === "sent" ? "text-foreground/50" : "text-amber-700 dark:text-amber-400"}`}>
                    {EMAIL_LABEL[c.emailStatus] ?? c.emailStatus}
                    {c.emailStatus === "sent" && c.ownerEmail ? ` (${c.ownerEmail})` : c.emailError ? `: ${c.emailError}` : ""}
                  </p>
                )}
                <OwnerContractActions
                  contractId={c.id}
                  vehicleId={vehicleId}
                  canVoid={isAdmin && !c.voidedAt}
                  canResend={Boolean(c.ownerEmail)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
