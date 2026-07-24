import { languageLabels } from "@/lib/labels";
import { formatArs } from "@/lib/contract";
import { CompareRow } from "../compare-row";
import type { StepContext } from "../context";

export function StepResumen({ ctx }: { ctx: StepContext }) {
  const { draft, props, isHandover, maxFuel, kmDriven, settlement, photosPending, online, queuedSubmit } = ctx;
  return (
    <div className="flex flex-col gap-3">
      <div className="divide-y divide-foreground/10 rounded-xl border border-foreground/10 px-4">
        {isHandover && <CompareRow label="Cliente" value={draft.clientName || "—"} />}
        <CompareRow label="Vehículo" value={props.vehicle?.label ?? props.vehicleOptions.find((v) => v.id === draft.vehicleId)?.label ?? "—"} />
        <CompareRow label="Kilometraje" value={`${Number(draft.km || 0).toLocaleString("es-AR")} km`} />
        <CompareRow label="Nafta" value={`${draft.fuelLevel}/${maxFuel}`} />
        {props.returnContext && <CompareRow label="Km recorridos" value={`${kmDriven.toLocaleString("es-AR")} km`} />}
        {settlement && settlement.balanceDue > 0 && (
          <CompareRow label="Saldo a cobrar" value={formatArs(settlement.balanceDue)} tone="warn" />
        )}
        {settlement && settlement.depositReturn > 0 && (
          <CompareRow label="Depósito a devolver" value={formatArs(settlement.depositReturn)} />
        )}
        <CompareRow label="Fallas checklist" value={String(Object.values(draft.checklist).filter((v) => v === "fail").length)} />
        <CompareRow label="Daños nuevos" value={String(draft.damages.length)} />
        <CompareRow label="Fotos" value={String(draft.photos.filter((p) => p.key).length)} />
        <CompareRow label="Idioma del acta" value={languageLabels[draft.language]} />
      </div>
      {photosPending && (
        <p className="text-xs text-amber-600">
          {online ? "Esperá a que terminen de subir las fotos…" : "Hay fotos pendientes; se subirán al volver la señal."}
        </p>
      )}
      {queuedSubmit && (
        <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
          {online
            ? "Terminando de subir la evidencia; se guarda solo en cuanto suba. Dejá esta pantalla abierta."
            : "Sin señal. La entrega se guardará automáticamente al reconectar. Podés dejar esta pantalla abierta."}
        </p>
      )}
      <p className="text-xs text-foreground/50">
        {isHandover
          ? "Al guardar, el alquiler pasa a activo y el auto a alquilado."
          : "Al guardar, el alquiler se finaliza y el auto vuelve a disponible."}{" "}
        El acta y los emails se generan en segundo plano.
      </p>
    </div>
  );
}
