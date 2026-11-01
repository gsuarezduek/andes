"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { displayName } from "@/lib/user-display";

/**
 * Marca un ingreso "Hay que facturar" como ya facturado — mismo criterio que
 * "Resolver" en notas de equipo: cualquier rol puede hacerlo. No pide ni
 * guarda ningún dato de la factura en sí (eso es el libro aparte, ver
 * `createInvoice`) — es solo mover el ingreso de "Pendientes" a "Realizados"
 * en Caja → Facturación.
 */
export async function markCashMovementInvoiced(id: string) {
  const user = await requireUser();
  const existing = await prisma.cashMovement.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw new Error("Movimiento no encontrado");
  if (!existing.needsInvoice) throw new Error("Este movimiento no está marcado para facturar.");
  if (existing.invoicedAt) return; // ya estaba facturado — no-op, evita un doble click rompiendo algo

  await prisma.cashMovement.update({
    where: { id },
    data: { invoicedAt: new Date(), invoicedById: user.id, invoicedByName: displayName(user) },
  });
  revalidateInvoicing(existing.rentalId);
}

/** Por si se marcó facturado por error. Vuelve a "Pendientes". */
export async function unmarkCashMovementInvoiced(id: string) {
  await requireUser();
  const existing = await prisma.cashMovement.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw new Error("Movimiento no encontrado");
  if (!existing.invoicedAt) return;

  await prisma.cashMovement.update({
    where: { id },
    data: { invoicedAt: null, invoicedById: null, invoicedByName: null },
  });
  revalidateInvoicing(existing.rentalId);
}

const invoicingRequestSchema = z.object({
  invoicingName: z.string().trim().max(200).optional(),
  invoicingCuit: z.string().trim().max(20).optional(),
});

export type InvoicingActionResult = { ok: true } | { ok: false; error: string };

function revalidateInvoicing(rentalId: string | null) {
  revalidatePath("/caja");
  if (rentalId) revalidatePath(`/rentals/${rentalId}`);
}

/**
 * Manda un ingreso a Facturación a mano (ej. desde una reserva ya entregada,
 * o porque el cliente pidió factura después), o corrige los datos del
 * cliente de uno que ya está pendiente. Nombre/CUIT son opcionales: con
 * datos va a "Pedidos de clientes", sin datos queda con el resto. Al pasar
 * por acá deja de ser "automático" (`invoiceAuto`), así un cambio de cuenta
 * posterior no lo saca solo. Cualquier rol.
 */
export async function requestCashMovementInvoice(id: string, input: unknown): Promise<InvoicingActionResult> {
  const user = await requireUser();
  const parsed = invoicingRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const invoicingName = parsed.data.invoicingName || null;
  const invoicingCuit = parsed.data.invoicingCuit || null;

  const existing = await prisma.cashMovement.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) return { ok: false, error: "Movimiento no encontrado." };
  if (existing.type !== "income") return { ok: false, error: "Solo se facturan ingresos." };
  if (existing.isGuarantee || existing.guaranteeSourceId) return { ok: false, error: "Las garantías no se facturan." };
  if (existing.invoicedAt) return { ok: false, error: "Este ingreso ya está facturado." };

  const changes: { field: string; from: string; to: string }[] = [];
  if (!existing.needsInvoice) changes.push({ field: "Facturación", from: "—", to: "Pendiente de facturar" });
  if ((existing.invoicingName ?? "") !== (invoicingName ?? "")) {
    changes.push({ field: "Factura a nombre de", from: existing.invoicingName ?? "—", to: invoicingName ?? "—" });
  }
  if ((existing.invoicingCuit ?? "") !== (invoicingCuit ?? "")) {
    changes.push({ field: "CUIT de la factura", from: existing.invoicingCuit ?? "—", to: invoicingCuit ?? "—" });
  }
  if (changes.length === 0) return { ok: true };

  await prisma.$transaction([
    prisma.cashMovement.update({
      where: { id },
      data: { needsInvoice: true, invoiceAuto: false, invoicingName, invoicingCuit },
    }),
    prisma.cashMovementEdit.create({
      data: { cashMovementId: id, action: "updated", changes, editedById: user.id, editedByName: displayName(user) },
    }),
  ]);
  revalidateInvoicing(existing.rentalId);
  return { ok: true };
}

/**
 * Saca de Facturación un ingreso pendiente que se mandó por error. No se
 * puede si la cuenta factura sola (`PaymentMethod.autoInvoice`): eso se
 * factura sí o sí.
 */
export async function removeCashMovementInvoice(id: string): Promise<InvoicingActionResult> {
  const user = await requireUser();
  const existing = await prisma.cashMovement.findUnique({
    where: { id },
    include: { paymentMethod: { select: { autoInvoice: true, ownership: true } } },
  });
  if (!existing || existing.deletedAt) return { ok: false, error: "Movimiento no encontrado." };
  if (!existing.needsInvoice) return { ok: true };
  if (existing.invoicedAt) return { ok: false, error: "Este ingreso ya está facturado." };
  if (existing.paymentMethod?.ownership === "own" && existing.paymentMethod.autoInvoice) {
    return { ok: false, error: `Todo lo que entra a ${existing.paymentMethodName} se factura: no se puede quitar.` };
  }

  await prisma.$transaction([
    prisma.cashMovement.update({
      where: { id },
      data: { needsInvoice: false, invoiceAuto: false, invoicingName: null, invoicingCuit: null },
    }),
    prisma.cashMovementEdit.create({
      data: {
        cashMovementId: id,
        action: "updated",
        changes: [{ field: "Facturación", from: "Pendiente de facturar", to: "No se factura" }],
        editedById: user.id,
        editedByName: displayName(user),
      },
    }),
  ]);
  revalidateInvoicing(existing.rentalId);
  return { ok: true };
}

const createInvoiceSchema = z.object({
  amount: z.number().positive(),
  currency: z.enum(["ars", "usd"]).default("ars"),
  date: z
    .string()
    .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v), "Fecha inválida"),
  razonSocial: z.string().trim().min(1, "Hace falta el nombre o razón social").max(200),
  cuit: z.string().trim().min(1, "Hace falta el CUIT").max(20),
});

export type CreateInvoiceResult = { ok: true } | { ok: false; error: string };

/**
 * Cargar una factura: registro suelto, sin vínculo formal con los ingresos
 * marcados "Hay que facturar" (ver el comentario del modelo `Invoice` en el
 * schema) — es simplemente una planilla de lo emitido.
 */
export async function createInvoice(input: unknown): Promise<CreateInvoiceResult> {
  const user = await requireUser();
  const parsed = createInvoiceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const { amount, currency, date, razonSocial, cuit } = parsed.data;

  await prisma.invoice.create({
    data: {
      amount,
      currency,
      date: new Date(`${date}T00:00:00.000Z`),
      razonSocial,
      cuit,
      createdById: user.id,
      createdByName: displayName(user),
    },
  });

  revalidatePath("/caja");
  return { ok: true };
}

/** Borrado simple — es un libro de referencia, no plata real: si se cargó mal, se borra y se carga de nuevo. */
export async function deleteInvoice(id: string) {
  await requireUser();
  await prisma.invoice.delete({ where: { id } }).catch(() => null);
  revalidatePath("/caja");
}
