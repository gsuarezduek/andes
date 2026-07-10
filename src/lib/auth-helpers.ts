import { redirect } from "next/navigation";
import { auth } from "@/auth";

/** Devuelve el usuario de la sesión actual, o null si no hay sesión. */
export async function getSessionUser() {
  const session = await auth();
  return session?.user ?? null;
}

/** Exige sesión; si no hay, redirige a /login. */
export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Exige rol admin; si no, redirige al home. */
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}
