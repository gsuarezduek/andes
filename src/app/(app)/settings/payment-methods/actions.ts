"use server";

import { revalidatePath } from "next/cache";
import { PaymentMethodOwnership } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { parseDecimal } from "@/lib/number-input";

/** Texto recortado, o null si viene vacío. */
function strOrNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

/** % con signo (recargo/descuento), o null si viene vacío. */
function percentOrNull(v: FormDataEntryValue | null): number | null {
  const n = parseDecimal(String(v ?? ""));
  return n !== undefined ? n : null;
}

/** Cuenta propia o ajena: obligatorio, sin estado "indiferente" — el select
 *  del form siempre manda uno de los dos; si algo raro llega, cae en "own". */
function ownershipOrDefault(v: FormDataEntryValue | null): PaymentMethodOwnership {
  return v === "third_party" ? "third_party" : "own";
}

export async function createPaymentMethod(formData: FormData) {
  await requireAdmin();
  const name = strOrNull(formData.get("name"));
  if (!name) return;
  const max = await prisma.paymentMethod.aggregate({ _max: { ordering: true } });
  await prisma.paymentMethod.create({
    data: {
      name,
      adjustmentPercent: percentOrNull(formData.get("adjustmentPercent")),
      reference: strOrNull(formData.get("reference")),
      requiresNote: formData.get("requiresNote") === "on",
      ownership: ownershipOrDefault(formData.get("ownership")),
      ordering: (max._max.ordering ?? 0) + 1,
    },
  });
  revalidatePath("/settings/payment-methods");
}

export type PaymentMethodUpdateInput = {
  id: string;
  name: string;
  adjustmentPercent: string;
  reference: string;
  requiresNote: boolean;
  ownership: PaymentMethodOwnership;
};

/** Guarda de una sola vez los cambios pendientes de varios medios de pago
 *  (un solo botón "Guardar cambios" en vez de uno por fila). Ignora las
 *  entradas con nombre vacío (no debería pasar: el botón se deshabilita antes). */
export async function updatePaymentMethods(updates: PaymentMethodUpdateInput[]) {
  await requireAdmin();
  const valid = updates.filter((u) => u.name.trim() !== "");
  if (valid.length === 0) return;
  await prisma.$transaction(
    valid.map((u) =>
      prisma.paymentMethod.update({
        where: { id: u.id },
        data: {
          name: u.name.trim(),
          adjustmentPercent: percentOrNull(u.adjustmentPercent),
          reference: strOrNull(u.reference),
          requiresNote: u.requiresNote,
          ownership: u.ownership,
        },
      }),
    ),
  );
  revalidatePath("/settings/payment-methods");
}

export async function togglePaymentMethod(id: string) {
  await requireAdmin();
  const item = await prisma.paymentMethod.findUnique({ where: { id } });
  if (item) {
    await prisma.paymentMethod.update({ where: { id }, data: { active: !item.active } });
  }
  revalidatePath("/settings/payment-methods");
}

export async function deletePaymentMethod(id: string) {
  await requireAdmin();
  await prisma.paymentMethod.delete({ where: { id } });
  revalidatePath("/settings/payment-methods");
}

/** Reordena solo dentro del mismo grupo (propia/ajena) — la lista se muestra
 *  separada por `ownership`, así que "subir"/"bajar" no debe saltar de grupo. */
export async function movePaymentMethod(id: string, dir: "up" | "down") {
  await requireAdmin();
  const all = await prisma.paymentMethod.findMany({ orderBy: { ordering: "asc" } });
  const current = all.find((i) => i.id === id);
  if (!current) return;
  const group = all.filter((i) => i.ownership === current.ownership);
  const idx = group.findIndex((i) => i.id === id);
  const swap = dir === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swap < 0 || swap >= group.length) return;
  const a = group[idx];
  const b = group[swap];
  await prisma.$transaction([
    prisma.paymentMethod.update({ where: { id: a.id }, data: { ordering: b.ordering } }),
    prisma.paymentMethod.update({ where: { id: b.id }, data: { ordering: a.ordering } }),
  ]);
  revalidatePath("/settings/payment-methods");
}
