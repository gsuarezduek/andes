"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { signOut } from "@/auth";
import { requireUser, EMPLOYEE_VIEW_COOKIE } from "@/lib/auth-helpers";
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

/** Activa "Ver como empleado" (menú de cuenta). Solo un admin real puede prenderla. */
export async function enableEmployeeView() {
  const user = await requireUser();
  if (user.realRole !== "admin") return;

  const cookieStore = await cookies();
  cookieStore.set(EMPLOYEE_VIEW_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  revalidatePath("/", "layout");
}

export async function disableEmployeeView() {
  await requireUser();
  const cookieStore = await cookies();
  cookieStore.delete(EMPLOYEE_VIEW_COOKIE);
  revalidatePath("/", "layout");
}
