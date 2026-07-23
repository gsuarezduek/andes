import { Row } from "@/components/ui/row";
import { formatArs } from "@/lib/contract";
import { formatDate } from "@/lib/datetime";
import type { VehicleDetail } from "@/lib/vehicle-detail-queries";

export function VehicleInfo({ vehicle }: { vehicle: VehicleDetail }) {
  return (
    <>
      {vehicle.archivedAt && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          Este vehículo está archivado (baja de {formatDate(vehicle.archivedAt)}). No aparece en el
          dashboard, los listados operativos ni los QR. Su historial se conserva.
        </p>
      )}

      <div className="divide-y divide-foreground/10 rounded-xl border border-foreground/10 px-4">
        <Row label="Año" value={vehicle.year} />
        <Row label="Color" value={vehicle.color} />
        <Row
          label="Tarifa 1 día (ref.)"
          value={
            vehicle.dailyRate != null ? (
              <span>
                {formatArs(Number(vehicle.dailyRate))}
                {vehicle.dailyRateUpdatedAt && (
                  <span className="font-normal text-foreground/50"> · act. {formatDate(vehicle.dailyRateUpdatedAt)}</span>
                )}
              </span>
            ) : (
              "—"
            )
          }
        />
        <Row label="Kilometraje" value={`${vehicle.currentKm.toLocaleString("es-AR")} km`} />
        <Row
          label="Próximo service"
          value={
            vehicle.nextServiceKm ? (
              <span className={vehicle.currentKm >= vehicle.nextServiceKm ? "text-red-600 dark:text-red-400" : undefined}>
                {vehicle.nextServiceKm.toLocaleString("es-AR")} km
                {vehicle.currentKm < vehicle.nextServiceKm
                  ? ` · faltan ${(vehicle.nextServiceKm - vehicle.currentKm).toLocaleString("es-AR")} km`
                  : " · vencido"}
              </span>
            ) : (
              "—"
            )
          }
        />
        <Row label="Intervalo de service" value={vehicle.serviceIntervalKm ? `${vehicle.serviceIntervalKm.toLocaleString("es-AR")} km` : "—"} />
        <Row label="Líneas de combustible" value={`${vehicle.fuelLevels} líneas`} />
        <Row label="Número de motor" value={vehicle.engineNumber} />
        <Row label="Chasis" value={vehicle.chassisNumber} />
        <Row label="Empresa de seguro" value={vehicle.insuranceCompany} />
        <Row label="Número de póliza" value={vehicle.insurancePolicyNumber} />
        <Row label="Mapeo VikRentCar" value={vehicle.wpCarId ? `idcar ${vehicle.wpCarId} · unidad ${vehicle.wpCarIndex}` : "Sin mapear"} />
        <Row label="Notas" value={vehicle.notes} />
      </div>
    </>
  );
}
