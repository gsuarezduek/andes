"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/auth-helpers";

const addDamageSchema = z.object({
  posX: z.coerce.number().min(0).max(1),
  posY: z.coerce.number().min(0).max(1),
  description: z.string().trim().max(500).optional(),
  photoKey: z
    .string()
    .regex(/^uploads\/[a-zA-Z0-9_/.-]+$/)
    .optional(),
});

// Registrar un daño manualmente desde el perfil del auto, fuera de una
// inspección (inspectionId = null). Útil para dejar constancia de un rayón o
// golpe detectado en el día a día sin abrir una entrega/devolución. Queda como
// daño activo: se premarca en las próximas inspecciones hasta marcarlo reparado.
export async function addDamage(vehicleId: string, formData: FormData) {
  const user = await requireUser();
  const parsed = addDamageSchema.parse({
    posX: formData.get("posX"),
    posY: formData.get("posY"),
    description: formData.get("description") || undefined,
    photoKey: formData.get("photoKey") || undefined,
  });
  await prisma.damage.create({
    data: {
      vehicleId,
      posX: parsed.posX,
      posY: parsed.posY,
      description: parsed.description ?? null,
      photoUrl: parsed.photoKey ?? null,
      reportedById: user.id,
    },
  });
  revalidatePath(`/vehicles/${vehicleId}`);
}

// Cerrar el ciclo de vida de un daño ya arreglado: deja de contar como activo
// (no aparece en el perfil ni se premarca en las próximas inspecciones). No
// toca el acta que lo detectó — la evidencia histórica sigue intacta.
export async function markDamageRepaired(vehicleId: string, id: string) {
  const user = await requireUser();
  await prisma.damage.update({
    where: { id, vehicleId },
    data: { repaired: true, repairedById: user.id, repairedAt: new Date() },
  });
  revalidatePath(`/vehicles/${vehicleId}`);
}

// Borrar un daño cargado por error (solo admin). A diferencia de "reparado",
// esto lo elimina de la base porque nunca debió existir.
export async function deleteDamage(vehicleId: string, id: string) {
  await requireAdmin();
  await prisma.damage.delete({ where: { id, vehicleId } });
  revalidatePath(`/vehicles/${vehicleId}`);
}
