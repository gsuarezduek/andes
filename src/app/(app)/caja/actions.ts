"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";

const createMovementSchema = z.object({
  description: z.string().trim().min(1).max(500),
  amount: z.coerce.number().positive(),
  paymentMethodId: z.string().min(1),
  rentalId: z.string().optional(),
});

// Movimiento de Caja: cobro o pago. Cualquier rol puede cargarlo — la
// restricción de "solo agregar" para empleados es de UI (no ven el detalle),
// no de permisos de escritura. Inmutable: sin acciones de edición/borrado.
export async function createCashMovement(type: "income" | "expense", formData: FormData) {
  const user = await requireUser();
  const { description, amount, paymentMethodId, rentalId } = createMovementSchema.parse({
    description: formData.get("description"),
    amount: formData.get("amount"),
    paymentMethodId: formData.get("paymentMethodId"),
    rentalId: formData.get("rentalId") || undefined,
  });

  const method = await prisma.paymentMethod.findUnique({ where: { id: paymentMethodId } });
  if (!method) throw new Error("Medio de pago inválido");

  await prisma.cashMovement.create({
    data: {
      type,
      description,
      amount,
      paymentMethodId: method.id,
      paymentMethodName: method.name,
      rentalId: rentalId || null,
      createdById: user.id,
    },
  });

  revalidatePath("/caja");
}
