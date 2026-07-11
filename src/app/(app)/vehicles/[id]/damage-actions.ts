"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/auth-helpers";

// Cerrar el ciclo de vida de un daño ya arreglado: deja de contar como activo
// (no aparece en el perfil ni se premarca en las próximas inspecciones). No
// toca el acta que lo detectó — la evidencia histórica sigue intacta.
export async function markDamageRepaired(vehicleId: string, id: string) {
  await requireUser();
  await prisma.damage.update({
    where: { id, vehicleId },
    data: { repaired: true },
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
