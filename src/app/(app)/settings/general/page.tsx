import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { ButtonLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField } from "@/components/ui/fields";
import { SavedBanner } from "@/components/ui/saved-banner";
import { SectionHeading } from "@/components/ui/section-heading";
import { SubsectionTitle } from "@/components/ui/subsection-title";
import { formatDateTime } from "@/lib/datetime";
import type { FieldChange } from "@/lib/movement-audit";
import { DEFAULT_SERVICE_OVERDUE_RED_PERCENT } from "@/lib/service-alerts";
import { saveConditions } from "../actions";
import { createChecklistItem } from "../../checklist/actions";
import { ChecklistItemRow } from "./checklist-item-row";

export const metadata: Metadata = { title: "Condiciones y checklist — Andes" };

export default async function GeneralSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireAdmin();
  const { saved } = await searchParams;

  const [conditions, items, conditionEdits] = await Promise.all([
    prisma.conditionSettings.findUnique({ where: { id: 1 } }),
    prisma.checklistItem.findMany({ orderBy: { ordering: "asc" } }),
    prisma.conditionSettingsEdit.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { editedBy: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Condiciones y checklist</h1>
        <p className="text-sm text-foreground/60">
          Condiciones económicas precargadas y checklist de entrega/devolución.
        </p>
      </div>

      <SavedBanner show={saved === "1"} label="Condiciones guardadas." />

      {/* Condiciones económicas (precarga global) */}
      <section className="flex flex-col gap-5">
        <SectionHeading description="Valores por defecto que el empleado ve precargados al iniciar la entrega y puede ajustar antes de firmar. El precio por día y los días se traen de la reserva.">
          Condiciones
        </SectionHeading>
        <form action={saveConditions} className="flex flex-col gap-5">
          <div className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-4">
            <SubsectionTitle>Condiciones económicas</SubsectionTitle>
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
                label="Precio por pack de KM (autos)"
                prefix="$"
                hint="200 km c/u, de 1 a 20 packs"
                type="text"
                inputMode="decimal"
                placeholder="—"
                defaultValue={conditions?.kmPackPrice?.toString()}
              />
              <TextField
                id="kmPackPriceTruck"
                label="Precio por pack de KM (camionetas)"
                prefix="$"
                hint="Para autos marcados «Es camioneta» en su ficha"
                type="text"
                inputMode="decimal"
                placeholder="—"
                defaultValue={conditions?.kmPackPriceTruck?.toString()}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-4">
            <SubsectionTitle description="Un auto con el service vencido se muestra en ámbar mientras el excedente no supere este % del intervalo de service del auto; por encima, pasa a rojo.">
              Alertas de service (dashboard)
            </SubsectionTitle>
            <TextField
              id="serviceOverdueRedPercent"
              label="% de gracia antes de pasar a rojo"
              suffix="%"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder={String(DEFAULT_SERVICE_OVERDUE_RED_PERCENT)}
              defaultValue={conditions?.serviceOverdueRedPercent?.toString()}
            />
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-4">
            <SubsectionTitle description="El admin siempre recibe una copia; esto solo controla si también le llega al cliente.">
              Envío de actas al cliente
            </SubsectionTitle>
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

        {conditionEdits.length > 0 && (
          <details className="rounded-xl border border-foreground/10 px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-foreground/70">
              Historial de cambios ({conditionEdits.length})
            </summary>
            <ul className="mt-3 flex flex-col gap-3">
              {conditionEdits.map((e) => (
                <li key={e.id} className="text-sm">
                  <p className="text-xs text-foreground/50">
                    {e.editedBy?.name ?? "—"} · {formatDateTime(e.createdAt)}
                  </p>
                  <ul className="mt-1 list-disc pl-4 text-xs text-foreground/70">
                    {(e.changes as FieldChange[]).map((c, i) => (
                      <li key={i}>
                        {c.field}: {c.from} → {c.to}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* Checklist */}
      <section className="flex flex-col gap-4">
        <SectionHeading
          description={`Ítems de verificación de la entrega/devolución. ${items.filter((i) => i.active).length} activos.`}
        >
          Checklist
        </SectionHeading>

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
