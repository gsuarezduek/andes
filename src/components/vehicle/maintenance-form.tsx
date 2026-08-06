import { SubmitButton } from "@/components/ui/submit-button";
import { maintenanceTypeLabels } from "@/lib/labels";
import { createMaintenance } from "@/app/(app)/vehicles/[id]/maintenance-actions";
import { MaintenanceFormFields, type PaymentMethodOption } from "./maintenance-form-fields";

const ALL_TYPES = Object.entries(maintenanceTypeLabels).map(([value, label]) => ({ value, label }));

export function MaintenanceForm({
  vehicleId,
  currentKm,
  paymentMethods,
}: {
  vehicleId: string;
  currentKm: number;
  paymentMethods: PaymentMethodOption[];
}) {
  return (
    <form action={createMaintenance.bind(null, vehicleId)} className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-4">
      <MaintenanceFormFields types={ALL_TYPES} defaultType="service" currentKm={currentKm} paymentMethods={paymentMethods} />
      <SubmitButton pendingLabel="Agregando…">Agregar registro</SubmitButton>
    </form>
  );
}
