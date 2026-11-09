import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { hasAdminAccess, resolveViewAs } from "@/lib/user-permissions";

/**
 * Cookie de "Ver como…" (menú de cuenta): guarda el rol elegido. Solo vale si
 * es un rol que la sesión real puede usar (`viewableRoles`); cualquier otro
 * valor se ignora.
 */
export const VIEW_AS_COOKIE = "andes_view_as";
/** Cookie vieja de "Ver como empleado" (valor "1"); se sigue leyendo hasta que venza. */
export const LEGACY_EMPLOYEE_VIEW_COOKIE = "andes_view_as_employee";

/**
 * Devuelve el usuario de la sesión actual, o null si no hay sesión.
 *
 * Si se activó "Ver como…" con un rol permitido, `role` viaja pisado a ese
 * rol y `owner` a false — así toda la app (nav, dashboard, `requireAdmin`,
 * cuentas de Finanzas) se comporta exactamente como para un usuario real de
 * ese rol, sin duplicar el gating en cada página. `realRole`/`realOwner`
 * conservan la sesión real (nunca los pisa la cookie) para armar el menú que
 * vuelve a la vista propia; `viewAs` es el rol simulado, o null. Nadie puede
 * subirse de rango con esto: `resolveViewAs` solo acepta roles menores (o
 * cualquiera, para el propietario).
 */
export async function getSessionUser() {
  const session = await auth();
  const user = session?.user ?? null;
  if (!user) return null;

  const realRole = user.role;
  // `realOwner`: propietario real, aunque esté viendo como otro rol (la vista
  // no debe cambiar que su sesión no venza por inactividad).
  const realOwner = user.owner;

  const cookieStore = await cookies();
  const raw =
    cookieStore.get(VIEW_AS_COOKIE)?.value ??
    (cookieStore.get(LEGACY_EMPLOYEE_VIEW_COOKIE)?.value === "1" ? "empleado" : undefined);
  const viewAs = resolveViewAs(raw, realRole, realOwner);

  return {
    ...user,
    role: viewAs ?? realRole,
    owner: viewAs ? false : realOwner,
    realRole,
    realOwner,
    viewAs,
  };
}

/** Exige sesión; si no hay, redirige a /login. */
export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Exige acceso de nivel admin (admin/finanzas/observador); si no, redirige al home. */
export async function requireAdmin() {
  const user = await requireUser();
  if (!hasAdminAccess(user.role)) redirect("/");
  return user;
}
