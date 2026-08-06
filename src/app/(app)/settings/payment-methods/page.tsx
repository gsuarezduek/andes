import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { ButtonLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField, TextareaField, SelectField } from "@/components/ui/fields";
import { createPaymentMethod } from "./actions";
import { PaymentMethodsEditor } from "./payment-methods-editor";

export const metadata: Metadata = { title: "Medios de pago — Andes" };

export default async function PaymentMethodsSettingsPage() {
  await requireAdmin();

  const items = await prisma.paymentMethod.findMany({ orderBy: { ordering: "asc" } });

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Medios de pago</h1>
          <p className="text-sm text-foreground/60">
            Se ofrecen al agregar un pago en la entrega. El % es un recargo (+) o descuento (−)
            sobre el importe de esa línea. La referencia (alias/CVU) es solo interna: se le
            muestra al empleado al elegir el medio, nunca sale en el acta.
          </p>
        </div>
        <ButtonLink href="/settings" variant="secondary">
          Volver
        </ButtonLink>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground/80">Nuevo medio de pago</h2>
        <form action={createPaymentMethod} className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-3">
          <div className="grid grid-cols-2 gap-3">
            <TextField id="name" label="Nombre" required placeholder="Ej. Tarjeta de crédito" />
            <TextField
              id="adjustmentPercent"
              label="% (recargo/descuento)"
              type="text"
              inputMode="decimal"
              placeholder="Ej. 10 o -5"
            />
          </div>
          <TextareaField id="reference" label="Referencia (alias/CVU)" rows={2} placeholder="Ej. Alias: mdzrentacar.mp" />
          <SelectField id="ownership" label="Cuenta" required defaultValue="own">
            <option value="own">Cuenta propia</option>
            <option value="third_party">Cuenta ajena (proveedor/empleado)</option>
          </SelectField>
          <label className="flex items-center gap-2 text-sm text-foreground/80">
            <input type="checkbox" name="requiresNote" className="h-4 w-4" />
            Requiere aclaración (ej. &quot;Otro&quot;: pide indicar a dónde fue el pago)
          </label>
          <div className="flex justify-end">
            <SubmitButton pendingLabel="Agregando…">Agregar</SubmitButton>
          </div>
        </form>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-foreground/80">{items.length} medios de pago</h2>
        <PaymentMethodsEditor items={items} />
      </section>
    </div>
  );
}
