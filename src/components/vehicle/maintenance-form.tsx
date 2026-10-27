import { SubmitButton } from "@/components/ui/submit-button";
import { maintenanceTypeLabels } from "@/lib/labels";
import { createMaintenance } from "@/app/(app)/vehicles/[id]/maintenance-actions";
import { MaintenanceFormFields } from "./maintenance-form-fields";
import type { DebtAccountOption } from "./maintenance-debt-account-field";

const ALL_TYPES = Object.entries(maintenanceTypeLabels).map(([value, label]) => ({ value, label }));

export function MaintenanceForm({
  vehicleId,
  currentKm,
  debtAccounts,
}: {
  vehicleId: string;
  currentKm: number;
  debtAccounts: DebtAccountOption[];
}) {
  return (
    <form action={createMaintenance.bind(null, vehicleId)} className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-4">
      <MaintenanceFormFields types={ALL_TYPES} defaultType="service" currentKm={currentKm} debtAccounts={debtAccounts} />
      <SubmitButton pendingLabel="Agregando…">Agregar registro</SubmitButton>
    </form>
  );
}
