import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { saveConditions } from "../actions";
import {
  createChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
  moveChecklistItem,
} from "../../checklist/actions";

export const metadata: Metadata = { title: "Condiciones y checklist — Andes" };

function ConditionField({
  name,
  label,
  hint,
  defaultValue,
  prefix,
  suffix,
  decimal = false,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultValue?: string;
  prefix?: string;
  suffix?: string;
  /** Importes en pesos aceptan decimales (coma o punto); km/% son enteros. */
  decimal?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-foreground/80">{label}</span>
      <div className="flex items-center gap-2 rounded-lg border border-foreground/15 px-3 focus-within:border-foreground/40">
        {prefix ? <span className="text-sm text-foreground/50">{prefix}</span> : null}
        <input
          name={name}
          type={decimal ? "text" : "number"}
          inputMode={decimal ? "decimal" : "numeric"}
          min={decimal ? undefined : 0}
          defaultValue={defaultValue}
          placeholder="—"
          className="h-11 flex-1 bg-transparent text-base outline-none"
        />
        {suffix ? <span className="text-sm text-foreground/50">{suffix}</span> : null}
      </div>
      {hint ? <span className="text-xs text-foreground/50">{hint}</span> : null}
    </label>
  );
}

export default async function GeneralSettingsPage() {
  await requireAdmin();

  const [conditions, items] = await Promise.all([
    prisma.conditionSettings.findUnique({ where: { id: 1 } }),
    prisma.checklistItem.findMany({ orderBy: { ordering: "asc" } }),
  ]);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Condiciones y checklist</h1>
        <p className="text-sm text-foreground/60">
          Condiciones económicas precargadas y checklist de entrega/devolución.
        </p>
      </div>

      {/* Condiciones económicas (precarga global) */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">Condiciones</h2>
          <p className="text-sm text-foreground/60">
            Valores por defecto que el empleado ve precargados al iniciar la entrega y puede
            ajustar antes de firmar. El precio por día y los días se traen de la reserva.
          </p>
        </div>
        <form action={saveConditions} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <ConditionField
              name="insuranceAmount"
              label="Seguro"
              prefix="$"
              decimal
              defaultValue={conditions?.insuranceAmount?.toString()}
            />
            <ConditionField
              name="kmPerDay"
              label="Km por día"
              suffix="km"
              defaultValue={conditions?.kmPerDay?.toString()}
            />
            <ConditionField
              name="extraKmRate"
              label="Km extra"
              prefix="$"
              suffix="c/u"
              decimal
              defaultValue={conditions?.extraKmRate?.toString()}
            />
            <ConditionField
              name="extraHourPercent"
              label="Hora extra"
              suffix="%"
              hint="% de la tarifa diaria"
              defaultValue={conditions?.extraHourPercent?.toString()}
            />
            <ConditionField
              name="deductible"
              label="Franquicia estándar"
              prefix="$"
              hint="deducible del seguro"
              decimal
              defaultValue={conditions?.deductible?.toString()}
            />
            <ConditionField
              name="deductibleReduced"
              label="Franquicia con mejora de seguro"
              prefix="$"
              hint="franquicia reducida"
              decimal
              defaultValue={conditions?.deductibleReduced?.toString()}
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-foreground/50">
              Dejá un campo vacío para no precargarlo. Andes no procesa cobros.
            </p>
            <SubmitButton>Guardar</SubmitButton>
          </div>
        </form>
      </section>

      {/* Checklist */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">Checklist</h2>
          <p className="text-sm text-foreground/60">
            Ítems de verificación de la entrega/devolución. {items.filter((i) => i.active).length}{" "}
            activos.
          </p>
        </div>

        <form action={createChecklistItem} className="flex gap-2">
          <input
            name="label"
            required
            placeholder="Nuevo ítem…"
            className="h-11 flex-1 rounded-lg border border-foreground/15 bg-transparent px-3 text-base outline-none focus:border-foreground/40"
          />
          <SubmitButton pendingLabel="Agregando…">Agregar</SubmitButton>
        </form>

        <ul className="flex flex-col divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
          {items.map((it, i) => (
            <li key={it.id} className="flex items-center gap-2 px-3 py-2">
              <div className="flex flex-col">
                <form action={moveChecklistItem.bind(null, it.id, "up")}>
                  <button disabled={i === 0} className="px-1 text-xs text-foreground/50 disabled:opacity-30" aria-label="Subir">▲</button>
                </form>
                <form action={moveChecklistItem.bind(null, it.id, "down")}>
                  <button disabled={i === items.length - 1} className="px-1 text-xs text-foreground/50 disabled:opacity-30" aria-label="Bajar">▼</button>
                </form>
              </div>
              <span className={`flex-1 text-sm ${it.active ? "" : "text-foreground/40 line-through"}`}>
                {it.label}
              </span>
              {!it.active && <Badge tone="neutral">Inactivo</Badge>}
              <form action={toggleChecklistItem.bind(null, it.id)}>
                <button className="rounded-md px-2 py-1 text-xs font-medium text-foreground/60 hover:bg-foreground/5">
                  {it.active ? "Desactivar" : "Activar"}
                </button>
              </form>
              <form action={deleteChecklistItem.bind(null, it.id)}>
                <button className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-500/10">
                  Borrar
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <ButtonLink href="/settings" variant="secondary">Volver a Configuración</ButtonLink>
    </div>
  );
}
