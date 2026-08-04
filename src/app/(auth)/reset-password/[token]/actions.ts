"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { hashPasswordResetToken, isPasswordResetTokenUsable } from "@/lib/password-reset";

export type ResetPasswordState = { error?: string };

/**
 * Confirma la nueva contraseña. Re-valida el token server-side (no solo en el
 * render de la página, por si venció entre que se mostró el form y el
 * submit) y lo consume de forma atómica (`updateMany` con `usedAt: null`, el
 * mismo patrón de un solo uso que la firma remota).
 */
export async function resetPassword(
  token: string,
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 6) {
    return { error: "La contraseña debe tener al menos 6 caracteres." };
  }
  if (password !== confirm) {
    return { error: "La confirmación no coincide con la contraseña." };
  }

  const tokenHash = hashPasswordResetToken(token);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!record || !isPasswordResetTokenUsable(record, new Date())) {
    return { error: "El link venció o ya fue usado. Pedí uno nuevo." };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const consumed = await prisma.$transaction(async (tx) => {
    // updateMany con usedAt: null es el guard atómico de un solo uso: si dos
    // requests llegan con el mismo token, solo una consume el registro.
    const res = await tx.passwordResetToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (res.count === 0) return false;
    await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
    return true;
  });
  if (!consumed) {
    return { error: "El link venció o ya fue usado. Pedí uno nuevo." };
  }

  redirect("/login?reset=1");
}
