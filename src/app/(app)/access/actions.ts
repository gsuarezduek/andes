"use server";

import { revalidatePath } from "next/cache";
import type { AccessCredentialField } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { displayName } from "@/lib/user-display";
import { encrypt, decrypt } from "@/lib/encryption";
import { canRevealAccessCredential } from "@/lib/access-credentials";

export type FormState = { error?: string };

// Cargar, editar y borrar un acceso es tarea de cualquiera (es un gestor de
// contraseñas compartido del equipo, no una función de admin) — la única
// restricción es REVELAR password/extra de un acceso `adminOnly`, que valida
// `revealAccessCredentialField` server-side.
export async function createAccessCredential(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const service = String(formData.get("service") ?? "").trim();
  if (!service) return { error: "El sitio o servicio es obligatorio." };
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const extra = String(formData.get("extra") ?? "");
  const adminOnly = formData.get("adminOnly") === "on";

  await prisma.accessCredential.create({
    data: {
      service,
      username: username || null,
      passwordEnc: password ? encrypt(password) : null,
      extraEnc: extra ? encrypt(extra) : null,
      adminOnly,
      createdById: user.id,
      createdByName: displayName(user),
    },
  });

  revalidatePath("/access");
  return {};
}

// Edición: password/extra viajan siempre vacíos del lado del cliente (nunca
// se reimprime el valor real en el form, mismo criterio que los secretos de
// WhatsApp) — un valor nuevo no vacío reemplaza, vacío sin marcar "Quitar"
// deja el actual sin tocar, y "Quitar" lo borra explícitamente.
export async function updateAccessCredential(id: string, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const service = String(formData.get("service") ?? "").trim();
  if (!service) return { error: "El sitio o servicio es obligatorio." };
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const extra = String(formData.get("extra") ?? "");
  const removePassword = formData.get("removePassword") === "on";
  const removeExtra = formData.get("removeExtra") === "on";
  const adminOnly = formData.get("adminOnly") === "on";

  const existing = await prisma.accessCredential.findUnique({
    where: { id },
    select: { passwordEnc: true, extraEnc: true },
  });
  if (!existing) return { error: "Este acceso ya no existe." };

  const passwordEnc = password ? encrypt(password) : removePassword ? null : existing.passwordEnc;
  const extraEnc = extra ? encrypt(extra) : removeExtra ? null : existing.extraEnc;

  await prisma.accessCredential.update({
    where: { id },
    data: {
      service,
      username: username || null,
      passwordEnc,
      extraEnc,
      adminOnly,
      updatedById: user.id,
      updatedByName: displayName(user),
    },
  });

  revalidatePath("/access");
  return {};
}

/** Borrado real — no es evidencia legal, mismo criterio que GPS/Tareas. */
export async function deleteAccessCredential(id: string): Promise<void> {
  await requireUser();
  await prisma.accessCredential.delete({ where: { id } });
  revalidatePath("/access");
}

/**
 * Descifra password/extra bajo pedido explícito ("Mostrar") y deja constancia
 * de quién lo vio y cuándo (`AccessCredentialReveal`). Nunca confía en que el
 * botón estuviera oculto en el cliente: revalida `adminOnly` acá.
 */
export async function revealAccessCredentialField(id: string, field: AccessCredentialField): Promise<string> {
  const user = await requireUser();
  const credential = await prisma.accessCredential.findUnique({
    where: { id },
    select: { adminOnly: true, passwordEnc: true, extraEnc: true },
  });
  if (!credential) throw new Error("Este acceso ya no existe.");
  if (!canRevealAccessCredential(credential.adminOnly, user.role)) {
    throw new Error("Solo un admin puede ver este campo.");
  }

  const enc = field === "password" ? credential.passwordEnc : credential.extraEnc;
  if (!enc) throw new Error("Este acceso no tiene ese campo cargado.");
  const value = decrypt(enc);

  await prisma.accessCredentialReveal.create({
    data: { accessCredentialId: id, field, userId: user.id, userName: displayName(user) },
  });
  revalidatePath("/access");

  return value;
}
