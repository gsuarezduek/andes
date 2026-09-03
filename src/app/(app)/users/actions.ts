"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";

export type FormState = { error?: string };

const baseSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio"),
  email: z.email("Email inválido"),
  role: z.enum(["admin", "empleado"]),
  active: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

function readBase(formData: FormData) {
  return baseSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    active: formData.get("active"),
  });
}

export async function createUser(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const parsed = readBase(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const password = String(formData.get("password") ?? "");
  if (password.length < 6) {
    return { error: "La contraseña debe tener al menos 6 caracteres." };
  }

  try {
    await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email.toLowerCase(),
        role: parsed.data.role,
        active: parsed.data.active,
        passwordHash: await bcrypt.hash(password, 10),
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Ya existe un usuario con ese email." };
    }
    throw e;
  }

  revalidatePath("/users");
  redirect("/users");
}

/**
 * Borra un usuario definitivamente (a diferencia de desactivarlo, que ya
 * existía). Requiere que ya esté inactivo — mismo criterio que archivar un
 * vehículo: primero se saca de circulación, después se puede borrar. Los
 * eventos puramente operativos sin valor legal (logins, tokens de
 * recuperación) se borran junto con el usuario — no hace falta conservarlos
 * una vez que la cuenta ya no existe. Si tiene actividad evidencial real
 * (inspecciones firmadas, ediciones de condiciones económicas), Postgres
 * rechaza el borrado por la FK requerida — se devuelve un mensaje claro en
 * vez de un 500; en ese caso, dejarlo inactivo sigue siendo la opción.
 */
export async function deleteUser(id: string): Promise<void> {
  const admin = await requireAdmin();
  if (id === admin.id) {
    throw new Error("No podés borrar tu propio usuario.");
  }

  const user = await prisma.user.findUnique({ where: { id }, select: { active: true } });
  if (!user) return;
  if (user.active) {
    throw new Error("Primero desactivá el usuario — recién ahí se puede borrar.");
  }

  try {
    await prisma.$transaction([
      prisma.loginEvent.deleteMany({ where: { userId: id } }),
      prisma.passwordResetToken.deleteMany({ where: { userId: id } }),
      prisma.user.delete({ where: { id } }),
    ]);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      throw new Error(
        "No se puede borrar: tiene inspecciones u otra actividad registrada en el sistema. Dejalo inactivo en su lugar.",
      );
    }
    throw e;
  }

  revalidatePath("/users");
  redirect("/users");
}

export async function updateUser(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = readBase(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  // Evitar que el admin se auto-bloquee o se quite el rol.
  if (id === admin.id) {
    if (!parsed.data.active) return { error: "No podés desactivar tu propio usuario." };
    if (parsed.data.role !== "admin") return { error: "No podés quitarte el rol de administrador." };
  }

  const password = String(formData.get("password") ?? "");
  if (password.length > 0 && password.length < 6) {
    return { error: "La contraseña debe tener al menos 6 caracteres." };
  }

  try {
    await prisma.user.update({
      where: { id },
      data: {
        name: parsed.data.name,
        email: parsed.data.email.toLowerCase(),
        role: parsed.data.role,
        active: parsed.data.active,
        ...(password.length >= 6
          ? { passwordHash: await bcrypt.hash(password, 10) }
          : {}),
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Ya existe un usuario con ese email." };
    }
    throw e;
  }

  revalidatePath("/users");
  redirect("/users");
}
