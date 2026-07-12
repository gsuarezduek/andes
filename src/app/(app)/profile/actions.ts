"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";

export type PasswordState = { error?: string; ok?: boolean };

/**
 * Permite al usuario cambiar su propia contraseña. Verifica la actual con
 * bcrypt antes de pisarla. No requiere admin: cada uno cambia la suya.
 */
export async function changePassword(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const sessionUser = await requireUser();

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (next.length < 6) {
    return { error: "La nueva contraseña debe tener al menos 6 caracteres." };
  }
  if (next !== confirm) {
    return { error: "La confirmación no coincide con la nueva contraseña." };
  }

  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
  if (!user) return { error: "Usuario no encontrado." };

  const valid = await bcrypt.compare(current, user.passwordHash);
  if (!valid) return { error: "La contraseña actual es incorrecta." };

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(next, 10) },
  });

  return { ok: true };
}
