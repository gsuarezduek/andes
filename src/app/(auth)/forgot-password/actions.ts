"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { generatePasswordResetToken, PASSWORD_RESET_TTL_MS } from "@/lib/password-reset";

export type ForgotPasswordState = { error?: string; ok?: boolean };

const schema = z.object({ email: z.email() });

// Mismo mensaje siempre, exista o no el email: evita que alguien use este
// formulario para descubrir qué emails están dados de alta.
const GENERIC_OK: ForgotPasswordState = { ok: true };

/**
 * Pide el link de recuperación. Nunca revela si el email existe o no; si el
 * usuario existe y está activo, genera un token nuevo (invalidando los
 * pendientes anteriores) y le manda el link por email.
 */
export async function requestPasswordReset(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const parsed = schema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: "Ingresá un email válido." };

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) return GENERIC_OK;

  const { token, tokenHash } = generatePasswordResetToken();

  await prisma.$transaction([
    // Limpia pedidos pendientes anteriores: solo el link más nuevo es válido.
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      },
    }),
  ]);

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.warn("[password-reset] Resend no configurado — email omitido");
    return GENERIC_OK;
  }

  const url = `${env.appUrl.replace(/\/$/, "")}/reset-password/${token}`;
  const html = `
    <p>Hola ${user.name},</p>
    <p>Pediste restablecer tu contraseña en Andes. Hacé clic en el siguiente link para elegir una nueva (vence en 1 hora):</p>
    <p><a href="${url}">${url}</a></p>
    <p>Si no fuiste vos, ignorá este email — tu contraseña actual sigue siendo válida.</p>
  `;

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  await resend.emails.send({
    from,
    to: [user.email],
    subject: "Recuperar contraseña — Andes",
    html,
  });

  return GENERIC_OK;
}
