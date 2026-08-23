import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { ButtonLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField, TextareaField } from "@/components/ui/fields";
import { SectionHeading } from "@/components/ui/section-heading";
import { createPaymentMethod } from "./actions";
import { PaymentMethodsEditor } from "./payment-methods-editor";
import { OwnershipFields } from "./ownership-fields";
import { WpPaymentMethodsEditor } from "@/components/settings/wp-payment-methods-editor";

export const metadata: Metadata = { title: "Medios de pago — Andes" };

export default async function PaymentMethodsSettingsPage() {
  await requireAdmin();

  const items = await prisma.paymentMethod.findMany({ orderBy: { ordering: "asc" } });
  const wpItems = await prisma.wpPaymentMethod.findMany({
    orderBy: { name: "asc" },
    include: { paymentMethods: { select: { id: true } } },
  });

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-8">
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
        <SectionHeading>Nuevo medio de pago</SectionHeading>
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
          <OwnershipFields />
          <label className="flex items-center gap-2 text-sm text-foreground/80">
            <input type="checkbox" name="requiresNote" className="h-4 w-4" />
            Requiere aclaración (ej. &quot;Otro&quot;: pide indicar a dónde fue el pago)
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground/80">
            <input type="checkbox" name="isCash" className="h-4 w-4" />
            Es efectivo físico (cuenta para el saldo de Billetera, en Caja)
          </label>
          <div className="flex justify-end">
            <SubmitButton pendingLabel="Agregando…">Agregar</SubmitButton>
          </div>
        </form>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading>{items.length} medios de pago</SectionHeading>
        <PaymentMethodsEditor items={items} />
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading description={'Nombres de método de pago que aparecieron en reservas sincronizadas (ej. "Stripe", "Transferencia de Banco") — se van agregando solos, no hay que cargarlos a mano. Asociá cada uno a uno o más medios de pago de Andes: cuando la asociación es a un único medio, la seña de esa reserva se importa a Caja ya confirmada; si no, queda pendiente de elegir el medio real.'}>
          Métodos de pago de VikRentCar
        </SectionHeading>
        <WpPaymentMethodsEditor
          items={wpItems.map((wp) => ({ id: wp.id, name: wp.name, linkedIds: wp.paymentMethods.map((m) => m.id) }))}
          paymentMethods={items.map((m) => ({ id: m.id, name: m.name }))}
        />
      </section>
    </div>
  );
}
