import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { ButtonLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField } from "@/components/ui/fields";
import { saveConditions } from "../actions";
import { createChecklistItem } from "../../checklist/actions";
import { ChecklistItemRow } from "./checklist-item-row";

export const metadata: Metadata = { title: "Condiciones y checklist — Andes" };

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
            <TextField
              id="kmPerDay"
              label="Km por día"
              suffix="km"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="—"
              defaultValue={conditions?.kmPerDay?.toString()}
            />
            <TextField
              id="extraKmRate"
              label="Km extra"
              prefix="$"
              suffix="c/u"
              type="text"
              inputMode="decimal"
              placeholder="—"
              defaultValue={conditions?.extraKmRate?.toString()}
            />
            <TextField
              id="extraHourPercent"
              label="Hora extra"
              suffix="%"
              hint="% de la tarifa diaria"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="—"
              defaultValue={conditions?.extraHourPercent?.toString()}
            />
            <TextField
              id="deductible"
              label="Franquicia/Garantía estándar"
              prefix="$"
              hint="deducible del seguro y garantía tomada"
              type="text"
              inputMode="decimal"
              placeholder="—"
              defaultValue={conditions?.deductible?.toString()}
            />
            <TextField
              id="deductibleReduced"
              label="Franquicia/Garantía con mejora de seguro"
              prefix="$"
              hint="reducida"
              type="text"
              inputMode="decimal"
              placeholder="—"
              defaultValue={conditions?.deductibleReduced?.toString()}
            />
            <TextField
              id="kmPackPrice"
              label="Precio por pack de KM"
              prefix="$"
              hint="200 km c/u, de 1 a 20 packs"
              type="text"
              inputMode="decimal"
              placeholder="—"
              defaultValue={conditions?.kmPackPrice?.toString()}
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-foreground/80">Envío de actas al cliente</p>
            <p className="mb-2 text-xs text-foreground/50">
              El admin siempre recibe una copia; esto solo controla si también le llega al cliente.
            </p>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="sendHandoverActa" defaultChecked={conditions?.sendHandoverActa ?? true} className="size-4" />
                Enviar Acta de Entrega
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="sendReturnActa" defaultChecked={conditions?.sendReturnActa ?? true} className="size-4" />
                Enviar Acta de Devolución
              </label>
            </div>
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
            <ChecklistItemRow key={it.id} item={it} isFirst={i === 0} isLast={i === items.length - 1} />
          ))}
        </ul>
      </section>

      <ButtonLink href="/settings" variant="secondary">Volver a Configuración</ButtonLink>
    </div>
  );
}
