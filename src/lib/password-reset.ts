import { randomBytes, createHash } from "node:crypto";

/**
 * Recuperar contraseña: token de un solo uso enviado por email. Tipos y
 * reglas compartidas entre las server actions de /forgot-password y
 * /reset-password. Mismo criterio que la firma remota (`remote-signature.ts`):
 * lógica pura y testeable, id no adivinable + expiración + un solo uso.
 */

/** Vida útil del link de recuperación (1 hora). */
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

/** Genera un token random (256 bits) y su hash sha256. El token va en el link
 * del email; solo el hash se guarda en la base. */
export function generatePasswordResetToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("hex");
  return { token, tokenHash: hashPasswordResetToken(token) };
}

export function hashPasswordResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** True si el token sigue siendo válido: no usado y no vencido. Pura y testeable. */
export function isPasswordResetTokenUsable(
  record: { usedAt: Date | null; expiresAt: Date },
  now: Date,
): boolean {
  return record.usedAt === null && record.expiresAt.getTime() > now.getTime();
}
