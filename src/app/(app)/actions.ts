"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { signOut } from "@/auth";
import { requireUser, VIEW_AS_COOKIE, LEGACY_EMPLOYEE_VIEW_COOKIE } from "@/lib/auth-helpers";
import { viewableRoles } from "@/lib/user-permissions";
import { prisma } from "@/lib/prisma";

/**
 * Polleado por `WhatsappSoundNotifier` (montado en el layout) para el sonido
 * de mensaje nuevo. Cuenta TODOS los mensajes entrantes alguna vez recibidos
 * — a propósito, no la cantidad de "no leídos" (esa es un estado derivado
 * que puede no subir aunque haya llegado un mensaje, por ejemplo si la
 * conversación está abierta y ya se marcó como leída). Este número solo
 * puede crecer, así que cualquier suba entre dos lecturas es, sin ambigüedad,
 * "llegó al menos un mensaje nuevo".
 */
export async function getInboundMessageCount() {
  await requireUser();
  return prisma.whatsAppMessage.count({ where: { direction: "in" } });
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}

/** Activa "Ver como…" un rol (menú de cuenta). Solo roles menores al real (o cualquiera, el propietario). */
export async function setViewAs(formData: FormData) {
  const user = await requireUser();
  const role = viewableRoles(user.realRole, user.realOwner).find((r) => r === formData.get("role"));
  if (!role) return;

  const cookieStore = await cookies();
  cookieStore.delete(LEGACY_EMPLOYEE_VIEW_COOKIE);
  cookieStore.set(VIEW_AS_COOKIE, role, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  revalidatePath("/", "layout");
}

/** Vuelve a la vista propia. */
export async function clearViewAs() {
  await requireUser();
  const cookieStore = await cookies();
  cookieStore.delete(VIEW_AS_COOKIE);
  cookieStore.delete(LEGACY_EMPLOYEE_VIEW_COOKIE);
  revalidatePath("/", "layout");
}
