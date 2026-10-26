"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/auth-helpers";
import { displayName } from "@/lib/user-display";
import { diffFields, type FieldChange } from "@/lib/movement-audit";
import { isDateKey, keyToDate, dateToKey } from "@/lib/rooms/dates";

const fileUrlSchema = z
  .string()
  .regex(/^uploads\/[a-zA-Z0-9_/.-]+$/)
  .optional();

const createPermitSchema = z.object({
  rentalId: z.string().min(1, "Elegí la reserva asociada."),
  formNumber: z.string().trim().min(1, "Falta el número completo de formulario.").max(100),
  expiresAt: z.string().refine(isDateKey, "Fecha de vencimiento inválida."),
  fileUrl: fileUrlSchema,
});

/** Alta de un permiso — cualquier rol (mismo criterio que la mayoría de Caja). */
export async function createPermit(formData: FormData) {
  const user = await requireUser();
  const parsed = createPermitSchema.parse({
    rentalId: formData.get("rentalId"),
    formNumber: formData.get("formNumber"),
    expiresAt: formData.get("expiresAt"),
    fileUrl: formData.get("fileUrl") || undefined,
  });

  const rental = await prisma.rental.findUnique({ where: { id: parsed.rentalId }, select: { id: true } });
  if (!rental) throw new Error("La reserva asociada no existe.");

  await prisma.permit.create({
    data: {
      rentalId: parsed.rentalId,
      formNumber: parsed.formNumber,
      expiresAt: keyToDate(parsed.expiresAt),
      fileUrl: parsed.fileUrl ?? null,
      createdById: user.id,
      createdByName: displayName(user),
    },
  });
  revalidatePath("/permits");
}

const updatePermitSchema = z.object({
  formNumber: z.string().trim().min(1, "Falta el número completo de formulario.").max(100),
  expiresAt: z.string().refine(isDateKey, "Fecha de vencimiento inválida."),
  fileUrl: fileUrlSchema,
});

function formatPermitValue(key: string, v: unknown): string {
  if (key === "fileUrl") return v ? "Archivo cargado" : "Sin archivo";
  return v == null || v === "" ? "—" : String(v);
}

/**
 * Edición de un permiso ya cargado — solo admin. La reserva asociada no se
 * edita (si está mal, se borra y se carga de nuevo, mismo criterio que
 * `CashMovement.type`). Cada cambio real queda auditado en `PermitEdit`; si
 * no cambió nada, no se registra nada.
 */
export async function updatePermit(id: string, formData: FormData) {
  const user = await requireAdmin();
  const parsed = updatePermitSchema.parse({
    formNumber: formData.get("formNumber"),
    expiresAt: formData.get("expiresAt"),
    fileUrl: formData.get("fileUrl") || undefined,
  });

  const existing = await prisma.permit.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw new Error("Permiso no encontrado.");

  const existingComparable = {
    formNumber: existing.formNumber,
    expiresAt: dateToKey(existing.expiresAt),
    fileUrl: existing.fileUrl,
  };
  const nextComparable = {
    formNumber: parsed.formNumber,
    expiresAt: parsed.expiresAt,
    fileUrl: parsed.fileUrl ?? existing.fileUrl ?? null,
  };

  const changes: FieldChange[] = diffFields(
    existingComparable,
    nextComparable,
    { formNumber: "Número de formulario", expiresAt: "Vencimiento", fileUrl: "Archivo adjunto" },
    formatPermitValue,
  );
  if (changes.length === 0) return;

  await prisma.$transaction([
    prisma.permit.update({
      where: { id },
      data: {
        formNumber: nextComparable.formNumber,
        expiresAt: keyToDate(nextComparable.expiresAt),
        fileUrl: nextComparable.fileUrl,
      },
    }),
    prisma.permitEdit.create({
      data: { permitId: id, action: "updated", changes, editedById: user.id, editedByName: displayName(user) },
    }),
  ]);
  revalidatePath("/permits");
}

/** Borrado (soft delete) de un permiso mal cargado — solo admin. */
export async function deletePermit(id: string) {
  const user = await requireAdmin();
  const existing = await prisma.permit.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw new Error("Permiso no encontrado.");

  await prisma.$transaction([
    prisma.permit.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: user.id, deletedByName: displayName(user) },
    }),
    prisma.permitEdit.create({
      data: { permitId: id, action: "deleted", editedById: user.id, editedByName: displayName(user) },
    }),
  ]);
  revalidatePath("/permits");
}
