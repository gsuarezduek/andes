import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";

/** Cookie que activa "ver como empleado" (menú de cuenta, solo para admins reales). */
export const EMPLOYEE_VIEW_COOKIE = "andes_view_as_employee";

/**
 * Devuelve el usuario de la sesión actual, o null si no hay sesión.
 *
 * Si el usuario es admin y activó "Ver como empleado", `role` viaja ya
 * pisado a "empleado" — así toda la app (nav, dashboard, `requireAdmin`)
 * se comporta exactamente como para un empleado real, sin duplicar el
 * gating en cada página. `realRole` conserva el rol real de la sesión
 * (nunca lo pisa la cookie) para poder mostrar/ejecutar el toggle que
 * vuelve a la vista admin. Un empleado real no puede auto-otorgarse esto:
 * el pisado solo aplica cuando `realRole === "admin"`.
 */
export async function getSessionUser() {
  const session = await auth();
  const user = session?.user ?? null;
  if (!user) return null;

  const realRole = user.role;
  if (realRole !== "admin") return { ...user, realRole };

  const cookieStore = await cookies();
  const viewingAsEmployee = cookieStore.get(EMPLOYEE_VIEW_COOKIE)?.value === "1";
  return { ...user, role: viewingAsEmployee ? ("empleado" as const) : realRole, realRole };
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
